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
    let explorer = std::env::var_os("WINDIR").map(std::path::PathBuf::from)
        .ok_or("No se encontró la carpeta de Windows.")?.join("explorer.exe");
    std::process::Command::new(explorer).arg(format!("{origin}/pago/{business_id}"))
        .spawn().map_err(|_| "No se pudo abrir el portal de pagos.".to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_checkout])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("No se pudo abrir KhypuPyme");
}
