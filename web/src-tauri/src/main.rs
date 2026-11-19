#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod browser;
mod vault;

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn native_save_file(app: AppHandle, name: String, content: String) -> Result<(), String> {
    let (stem, extension) = name.rsplit_once('.').ok_or("Nombre de archivo inválido.")?;
    if stem.is_empty()
        || !stem
            .bytes()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == b'-' || ch == b'_')
        || !matches!(extension, "pdf" | "json")
    {
        return Err("Nombre de archivo inválido.".into());
    }
    let bytes = STANDARD
        .decode(content)
        .map_err(|_| "Contenido de archivo inválido.")?;
    let extension = extension.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let picked = app
            .dialog()
            .file()
            .add_filter("KhypuPyme", &[&extension])
            .set_file_name(name)
            .blocking_save_file();
        if let Some(target) = picked {
            let path = target.into_path().map_err(|_| "Ubicación inválida.")?;
            std::fs::write(path, bytes).map_err(|_| "No se pudo guardar el archivo.")?;
        }
        Ok(())
    })
    .await
    .map_err(|_| "No se pudo abrir el diálogo de archivos.".to_owned())?
}

fn main() {
    tauri::Builder::default()
        .manage(browser::Callback::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("pilot-navigation")
                .on_navigation(|_, url| {
                    url.scheme() == "https" && url.host_str() == Some("tauri.localhost")
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            browser::native_start,
            browser::native_callback,
            vault::native_load,
            vault::native_save,
            vault::native_clear,
            native_save_file
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar KhypuPyme.");
}
