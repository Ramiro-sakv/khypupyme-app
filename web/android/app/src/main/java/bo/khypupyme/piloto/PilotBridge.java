package bo.khypupyme.piloto;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "PilotBridge")
public class PilotBridge extends Plugin {
    private static final String KEY = "khypupyme2-pilot-session";
    private static final String SESSION_ERROR = "No se pudo acceder a la sesión protegida.";
    private static final String FILE_ERROR = "No se pudo guardar el archivo.";

    @PluginMethod
    public void start(PluginCall call) {
        try {
            Uri url = Uri.parse(call.getString("url", ""));
            if (!url.toString().startsWith(BuildConfig.PILOT_ORIGIN + "/connect/authorize?")
                    || !"https".equals(url.getScheme())) {
                call.reject("El destino de ingreso no corresponde al piloto.");
                return;
            }
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url));
            call.resolve();
        } catch (RuntimeException error) { call.reject("No se pudo abrir el navegador."); }
    }

    @PluginMethod
    public void callback(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Intent intent = getActivity().getIntent();
            Uri uri = intent == null ? null : intent.getData();
            JSObject reply = new JSObject();
            if (uri != null && uri.toString().startsWith("bo.khypupyme.piloto:/oauth/callback?")) {
                reply.put("value", uri.toString());
                intent.setData(null);
            }
            call.resolve(reply);
        });
    }

    @PluginMethod
    public void load(PluginCall call) {
        try {
            String encrypted = preferences().getString(secretName(call), null);
            JSObject reply = new JSObject();
            if (encrypted != null) {
                byte[] packed = Base64.decode(encrypted, Base64.NO_WRAP);
                ByteBuffer packedBuffer = ByteBuffer.wrap(packed);
                byte[] iv = new byte[12];
                packedBuffer.get(iv);
                byte[] data = new byte[packedBuffer.remaining()];
                packedBuffer.get(data);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
                reply.put("value", new String(cipher.doFinal(data), StandardCharsets.UTF_8));
            }
            call.resolve(reply);
        } catch (Exception error) { call.reject(SESSION_ERROR); }
    }

    @PluginMethod
    public void save(PluginCall call) {
        try {
            String name = secretName(call);
            byte[] data = call.getString("value", "").getBytes(StandardCharsets.UTF_8);
            if (data.length == 0 || data.length > 65536) throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(data);
            byte[] iv = cipher.getIV();
            if (iv.length != 12) throw new IllegalStateException();
            String encoded = Base64.encodeToString(ByteBuffer.allocate(iv.length + encrypted.length)
                .put(iv).put(encrypted).array(), Base64.NO_WRAP);
            if (!preferences().edit().putString(name, encoded).commit()) throw new IllegalStateException();
            call.resolve();
        } catch (Exception error) { call.reject(SESSION_ERROR); }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            if (!preferences().edit().remove(secretName(call)).commit()) throw new IllegalStateException();
            call.resolve();
        } catch (Exception error) { call.reject(SESSION_ERROR); }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name", "");
        if (!name.matches("[a-zA-Z0-9_-]+[.](pdf|json)")) { call.reject(FILE_ERROR); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(name.endsWith(".pdf") ? "application/pdf" : "application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent response = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || response == null || response.getData() == null) {
            call.resolve();
            return;
        }
        try (OutputStream file = getContext().getContentResolver().openOutputStream(response.getData(), "wt")) {
            if (file == null) { call.reject(FILE_ERROR); return; }
            file.write(Base64.decode(call.getString("content", ""), Base64.NO_WRAP));
        } catch (Exception error) { call.reject(FILE_ERROR); return; }
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(KEY, Context.MODE_PRIVATE);
    }

    private static String secretName(PluginCall call) {
        String name = call.getString("name", "");
        if (!"handshake".equals(name) && !"token".equals(name)) throw new IllegalArgumentException();
        return name;
    }

    private static synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.getKey(KEY, null) instanceof SecretKey existing) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
}
