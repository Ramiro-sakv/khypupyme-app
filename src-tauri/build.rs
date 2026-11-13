fn main() {
    println!("cargo:rerun-if-env-changed=VITE_KHYPU_CHECKOUT_ORIGIN");
    tauri_build::build()
}
