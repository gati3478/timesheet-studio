use std::net::TcpListener;
use std::sync::Mutex;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct SidecarChild(Mutex<Option<CommandChild>>);

/// Find an available port by binding to port 0 and reading the assigned port.
fn get_free_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

/// Poll the sidecar server until it responds or timeout is reached.
/// Uses a raw TCP connect check — no HTTP library needed for localhost.
fn wait_for_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let addr = format!("127.0.0.1:{}", port);
    for _ in 0..150 {
        if std::net::TcpStream::connect(&addr).is_ok() {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Err(format!(
        "Server did not start within 15 seconds on port {}. Check if the app bundle is complete.",
        port
    )
    .into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarChild(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                WebviewWindowBuilder::new(
                    app,
                    "main",
                    WebviewUrl::External("http://localhost:5173".parse().unwrap()),
                )
                .title("Timesheet Studio [DEV]")
                .inner_size(1100.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .decorations(false)
                .shadow(true)
                .center()
                .build()?;
                return Ok(());
            }

            let port = get_free_port()?;
            let resource_dir = app.path().resource_dir()?;

            let server_script = resource_dir.join("resources").join("server-bundle.mjs");
            let template_dir = resource_dir.join("resources").join("templates");

            if !server_script.exists() {
                return Err(format!(
                    "Server bundle not found at {:?}. The app may be corrupted.",
                    server_script
                )
                .into());
            }

            let script_path = server_script
                .to_str()
                .ok_or("Server script path contains invalid UTF-8")?;
            let template_path = template_dir
                .to_str()
                .ok_or("Template dir path contains invalid UTF-8")?;

            let (mut rx, child) = app
                .shell()
                .sidecar("node-server")
                .map_err(|e| format!("Failed to create sidecar: {}", e))?
                .args([script_path])
                .env("PORT", port.to_string())
                .env("HOST", "127.0.0.1")
                .env("ORIGIN", format!("http://127.0.0.1:{}", port))
                .env("TEMPLATE_DIR", template_path)
                .env("NODE_ENV", "production")
                .spawn()
                .map_err(|e| format!("Failed to spawn server: {}", e))?;

            *app.state::<SidecarChild>()
                .0
                .lock()
                .expect("Sidecar mutex poisoned") = Some(child);

            // Forward sidecar output for diagnostics
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[server:err] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(status) => {
                            eprintln!("[server] process exited: {:?}", status);
                        }
                        _ => {}
                    }
                }
            });

            wait_for_server(port)?;

            let url = format!("http://127.0.0.1:{}", port);
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?),
            )
            .title("Timesheet Studio")
            .inner_size(1100.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .decorations(false)
            .shadow(true)
            .center()
            .build()?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app_handle
                    .state::<SidecarChild>()
                    .0
                    .lock()
                    .expect("Sidecar mutex poisoned")
                    .take()
                {
                    let _ = child.kill();
                }
            }
        });
}
