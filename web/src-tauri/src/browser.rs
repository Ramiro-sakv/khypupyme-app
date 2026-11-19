use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;
use url::Url;

const CALLBACK: &str = "http://127.0.0.1:43823";
const ORIGIN: &str = match option_env!("KHYPU_NATIVE_ORIGIN") {
    Some(value) => value,
    None => "https://khypupyme2-piloto.onrender.com",
};

#[derive(Default)]
pub struct Callback(Arc<Mutex<Option<String>>>);

#[tauri::command]
pub fn native_start(url: String, callback: State<Callback>) -> Result<(), String> {
    let destination = Url::parse(&url).map_err(|_| "Destino inválido.")?;
    if destination.origin().ascii_serialization() != ORIGIN
        || destination.path() != "/connect/authorize"
        || destination.fragment().is_some()
        || !destination.username().is_empty()
        || destination.password().is_some()
    {
        return Err("El destino de ingreso no corresponde al piloto.".into());
    }
    let state = destination
        .query_pairs()
        .find(|(key, _)| key == "state")
        .map(|(_, value)| value.into_owned())
        .filter(|value| {
            value.len() == 43
                && value
                    .bytes()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == b'_' || ch == b'-')
        })
        .ok_or("Falta el estado del ingreso.")?;
    let listener = TcpListener::bind(("127.0.0.1", 43823))
        .map_err(|_| "Ya hay un ingreso usando el puerto 43823.")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "No se pudo preparar el regreso.")?;
    *callback
        .0
        .lock()
        .map_err(|_| "No se pudo preparar el regreso.")? = None;

    Command::new("rundll32.exe")
        .creation_flags(0x08000000)
        .arg("url.dll,FileProtocolHandler")
        .arg(destination.as_str())
        .spawn()
        .map_err(|_| "No se pudo abrir el navegador.")?;

    let target = callback.0.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(300) {
            if let Ok((mut stream, _)) = listener.accept() {
                if let Some(url) = accept_callback(&mut stream, &state) {
                    if let Ok(mut current) = target.lock() {
                        *current = Some(url);
                    }
                    break;
                }
            } else {
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    });
    Ok(())
}

fn accept_callback(stream: &mut TcpStream, state: &str) -> Option<String> {
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok()?;
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .ok()?;
    let mut line = String::new();
    BufReader::new((&mut *stream).take(8192))
        .read_line(&mut line)
        .ok()?;
    let callback = parse_callback(&line, state);
    let (status, message) = if callback.is_some() {
        ("200 OK", "Ya puedes volver a KhypuPyme.")
    } else {
        (
            "400 Bad Request",
            "Esta solicitud no corresponde al ingreso abierto.",
        )
    };
    let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{message}", message.len());
    callback
}

fn parse_callback(line: &str, state: &str) -> Option<String> {
    let mut parts = line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let path = parts.next()?;
    if !path.starts_with("/callback?") {
        return None;
    }
    let url = Url::parse(&format!("{CALLBACK}{path}")).ok()?;
    let mut states = url.query_pairs().filter(|(key, _)| key == "state");
    let valid = states.next().is_some_and(|(_, value)| value == state) && states.next().is_none();
    valid.then(|| url.into())
}

#[tauri::command]
pub fn native_callback(callback: State<Callback>) -> Result<Option<String>, String> {
    Ok(callback
        .0
        .lock()
        .map_err(|_| "No se pudo recuperar el regreso.")?
        .take())
}

#[cfg(test)]
mod tests {
    use super::parse_callback;

    #[test]
    fn accepts_only_the_open_handshake() {
        assert!(parse_callback("GET /callback?code=example&state=own HTTP/1.1", "own").is_some());
        assert!(parse_callback("GET /callback?code=example&state=other HTTP/1.1", "own").is_none());
        assert!(parse_callback("GET /callback?state=own&state=other HTTP/1.1", "own").is_none());
        assert!(parse_callback("GET /elsewhere?state=own HTTP/1.1", "own").is_none());
    }
}
