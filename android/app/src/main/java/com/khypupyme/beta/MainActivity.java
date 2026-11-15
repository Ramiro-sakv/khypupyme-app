package com.khypupyme.beta;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KhypuBillingPlugin.class);
        registerPlugin(KhypuAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
