fn main() {
    println!("cargo:rerun-if-env-changed=KHYPU_NATIVE_ORIGIN");
    tauri_build::build();
}
