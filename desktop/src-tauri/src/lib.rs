use std::{
    fs::{create_dir_all, OpenOptions},
    io::Write,
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};

use reqwest::blocking::Client;
use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};
use tauri_plugin_dialog::{DialogExt, FilePath};

struct SidecarState {
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
}

#[derive(Serialize)]
struct LaunchDiagnostics {
    app_data_dir: String,
    database_path: String,
    documents_path: String,
    exports_path: String,
    logs_path: String,
    sidecar_port: Option<u16>,
    ollama_online: bool,
    ollama_error: Option<String>,
}

fn app_data_root() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("LocalChat")
}

fn ensure_app_dirs() -> (PathBuf, PathBuf, PathBuf, PathBuf) {
    let root = app_data_root();
    let database = root.join("localchat.db");
    let documents = root.join("documents");
    let exports = root.join("exports");
    let logs = root.join("logs");
    create_dir_all(&documents).expect("documents dir");
    create_dir_all(&exports).expect("exports dir");
    create_dir_all(&logs).expect("logs dir");
    (database, documents, exports, logs)
}

fn pick_loopback_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("loopback bind")
        .local_addr()
        .expect("local addr")
        .port()
}

fn append_log(logs_path: &PathBuf, line: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs_path.join("desktop.log"))
    {
        let _ = writeln!(file, "{line}");
    }
}

fn start_sidecar(app: &AppHandle, logs_path: &PathBuf) -> Result<(Child, u16), String> {
    let port = pick_loopback_port();
    let (database_path, documents_path, exports_path, _) = ensure_app_dirs();

    append_log(
        logs_path,
        &format!("Starting sidecar on 127.0.0.1:{port}"),
    );

    let sidecar = app
        .path()
        .resolve("bin/localchat-server", tauri::path::BaseDirectory::Resource);

    let child = if cfg!(debug_assertions) {
        let repo_root = std::env::current_dir().map_err(|error| error.to_string())?;
        let server_entry = repo_root.join("server").join("dist").join("index.js");
        Command::new("node")
            .arg(server_entry)
            .env("HOST", "127.0.0.1")
            .env("PORT", port.to_string())
            .env("DATABASE_PATH", database_path.to_string_lossy().to_string())
            .env("DOCUMENTS_PATH", documents_path.to_string_lossy().to_string())
            .env("EXPORTS_PATH", exports_path.to_string_lossy().to_string())
            .env("LOGS_PATH", logs_path.to_string_lossy().to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Failed to start dev sidecar: {error}"))?
    } else {
        let sidecar = sidecar.map_err(|error| error.to_string())?;
        Command::new(sidecar)
            .env("HOST", "127.0.0.1")
            .env("PORT", port.to_string())
            .env("DATABASE_PATH", database_path.to_string_lossy().to_string())
            .env("DOCUMENTS_PATH", documents_path.to_string_lossy().to_string())
            .env("EXPORTS_PATH", exports_path.to_string_lossy().to_string())
            .env("LOGS_PATH", logs_path.to_string_lossy().to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Failed to start sidecar: {error}"))?
    };

    Ok((child, port))
}

fn wait_for_health(port: u16) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|error| error.to_string())?;
    let url = format!("http://127.0.0.1:{port}/api/health");
    let started = Instant::now();
    while started.elapsed() < Duration::from_secs(30) {
        if let Ok(response) = client.get(&url).send() {
            if response.status().is_success() {
                return Ok(());
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err("Sidecar health check timed out".into())
}

fn stop_sidecar(state: &SidecarState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    if let Ok(mut port) = state.port.lock() {
        *port = None;
    }
}

#[tauri::command]
fn get_launch_diagnostics(state: State<SidecarState>) -> Result<LaunchDiagnostics, String> {
    let (database_path, documents_path, exports_path, logs_path) = ensure_app_dirs();
    let port = state.port.lock().map_err(|_| "lock poisoned".to_string())?;
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|error| error.to_string())?;
    let ollama = client.get("http://127.0.0.1:11434/api/tags").send();
    let (ollama_online, ollama_error) = match ollama {
        Ok(response) if response.status().is_success() => (true, None),
        Ok(response) => (false, Some(format!("Ollama status {}", response.status()))),
        Err(error) => (false, Some(error.to_string())),
    };

    Ok(LaunchDiagnostics {
        app_data_dir: app_data_root().to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        documents_path: documents_path.to_string_lossy().to_string(),
        exports_path: exports_path.to_string_lossy().to_string(),
        logs_path: logs_path.to_string_lossy().to_string(),
        sidecar_port: *port,
        ollama_online,
        ollama_error,
    })
}

#[tauri::command]
async fn pick_open_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("LocalChat backup", &["zip", "enc"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let picked = rx.recv().map_err(|error| error.to_string())?;
    Ok(match picked {
        Some(FilePath::Path(path)) => Some(path.to_string_lossy().to_string()),
        Some(FilePath::Url(url)) => Some(url.to_string()),
        None => None,
    })
}

#[tauri::command]
async fn pick_save_file(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("LocalChat backup", &["zip"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let picked = rx.recv().map_err(|error| error.to_string())?;
    Ok(match picked {
        Some(FilePath::Path(path)) => Some(path.to_string_lossy().to_string()),
        Some(FilePath::Url(url)) => Some(url.to_string()),
        None => None,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SidecarState {
            child: Mutex::new(None),
            port: Mutex::new(None),
        })
        .setup(|app| {
            let (_, _, _, logs_path) = ensure_app_dirs();
            let handle = app.handle().clone();
            let (child, port) = start_sidecar(&handle, &logs_path)?;
            wait_for_health(port)?;
            {
                let state = app.state::<SidecarState>();
                *state.child.lock().expect("lock child") = Some(child);
                *state.port.lock().expect("lock port") = Some(port);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(&format!(
                    "window.location.replace('http://127.0.0.1:{port}/');"
                ));
            }

            let show_item = MenuItem::with_id(app, "show", "Show LocalChat", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("LocalChat")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_launch_diagnostics,
            pick_open_file,
            pick_save_file
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<SidecarState>();
                stop_sidecar(&state);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LocalChat desktop");
}
