#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn open_checkout(business_id: String) -> Result<(), String> {
    let origin = option_env!("VITE_KHYPU_CHECKOUT_ORIGIN")
        .filter(|value| value.starts_with("https://"))
        .ok_or("El portal de pagos aún no está configurado.")?;
    if business_id.is_empty() || business_id.len() > 100 ||
        !business_id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_') {
        return Err("Identificador de negocio inválido.".into());
    }
    open_in_browser(format!("{origin}/pago/{business_id}"))
}

#[tauri::command]
fn open_auth_portal(id: String) -> Result<(), String> {
    let origin = option_env!("VITE_KHYPU_AUTH_PORTAL_ORIGIN")
        .filter(|value| value.starts_with("https://") &&
            value[8..].bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'.' || byte == b'-'))
        .filter(|value| value.len() > 8)
        .ok_or("El portal de acceso aún no está configurado.")?;
    if id.len() != 32 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Identificador de acceso inválido.".into());
    }
    open_in_browser(format!("{origin}/autorizar-app?id={id}"))
}

fn open_in_browser(url: String) -> Result<(), String> {
    let explorer = std::env::var_os("WINDIR").map(std::path::PathBuf::from)
        .ok_or("No se encontró la carpeta de Windows.")?.join("explorer.exe");
    std::process::Command::new(explorer).arg(url)
        .spawn().map_err(|_| "No se pudo abrir el navegador.".to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_checkout, open_auth_portal])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("No se pudo abrir KhypuPyme");
}
