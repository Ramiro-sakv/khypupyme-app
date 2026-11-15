package com.khypupyme.beta;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KhypuAuth")
public class KhypuAuthPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String id = call.getString("id");
        if (BuildConfig.AUTH_PORTAL.isEmpty() || id == null || !id.matches("[a-f0-9]{32}")) {
            call.reject("El portal de acceso no está configurado.");
            return;
        }
        Uri uri = Uri.parse(BuildConfig.AUTH_PORTAL + "/autorizar-app?id=" + id);
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("No se pudo abrir el navegador.");
        }
    }
}
