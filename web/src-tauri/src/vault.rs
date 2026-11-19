use std::{fs, io::ErrorKind, path::PathBuf, ptr::null};
use tauri::{AppHandle, Manager};
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

const ERROR: &str = "No se pudo acceder a la sesión protegida.";

fn secret_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if !matches!(name, "token" | "handshake") {
        return Err(ERROR.into());
    }
    let directory = app.path().app_local_data_dir().map_err(|_| ERROR)?;
    fs::create_dir_all(&directory).map_err(|_| ERROR)?;
    Ok(directory.join(format!("{name}.dpapi")))
}

fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len().try_into().map_err(|_| ERROR)?,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    // DPAPI allocates the output buffer for both operations and requires LocalFree.
    unsafe {
        let result = if encrypt {
            CryptProtectData(
                &input,
                null(),
                null(),
                null(),
                null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                null(),
                null(),
                null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if result == 0 || output.pbData.is_null() {
            return Err(ERROR.into());
        }
        let copy = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        if !encrypt {
            std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        }
        LocalFree(output.pbData.cast());
        Ok(copy)
    }
}

#[tauri::command]
pub fn native_save(app: AppHandle, name: String, value: String) -> Result<(), String> {
    if value.is_empty() || value.len() > 65536 {
        return Err(ERROR.into());
    }
    let path = secret_path(&app, &name)?;
    let temporary = path.with_extension("pending");
    fs::write(&temporary, protect(value.as_bytes(), true)?).map_err(|_| ERROR)?;
    fs::rename(temporary, path).map_err(|_| ERROR.into())
}

#[tauri::command]
pub fn native_load(app: AppHandle, name: String) -> Result<Option<String>, String> {
    match fs::read(secret_path(&app, &name)?) {
        Ok(data) => String::from_utf8(protect(&data, false)?)
            .map(Some)
            .map_err(|_| ERROR.into()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(_) => Err(ERROR.into()),
    }
}

#[tauri::command]
pub fn native_clear(app: AppHandle, name: String) -> Result<(), String> {
    match fs::remove_file(secret_path(&app, &name)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ERROR.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::protect;

    #[test]
    fn protects_a_session_for_the_current_windows_user() {
        let secret = b"fictitious-pilot-session";
        let protected = protect(secret, true).unwrap();
        assert_ne!(secret.as_slice(), protected);
        assert_eq!(secret.as_slice(), protect(&protected, false).unwrap());
    }
}
