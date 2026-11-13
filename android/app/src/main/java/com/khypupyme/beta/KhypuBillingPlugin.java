package com.khypupyme.beta;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

@CapacitorPlugin(name = "KhypuBilling")
public class KhypuBillingPlugin extends Plugin {
    private static final String PRODUCT = "khypupyme_30_dias";
    private BillingClient client;
    private PluginCall checkout;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .setListener(this::updated)
            .build();
    }

    private void ready(PluginCall call, Runnable action) {
        if (client.isReady()) {
            action.run();
            return;
        }
        if (client.getConnectionState() == BillingClient.ConnectionState.CONNECTING) {
            call.reject("Google Play está conectando. Vuelve a intentar.");
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            public void onBillingSetupFinished(BillingResult result) {
                if (ok(result)) action.run();
                else call.reject("No se pudo conectar con Google Play.");
            }
            public void onBillingServiceDisconnected() { }
        });
    }

    private boolean ok(BillingResult result) {
        return result.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private void product(PluginCall call, Consumer<ProductDetails> use) {
        ready(call, () -> {
            QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build();
            client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(item)).build(), (result, products) -> {
                    if (!ok(result) || products.getProductDetailsList().isEmpty()) {
                        call.reject("El pase todavía no está disponible en Google Play.");
                        return;
                    }
                    use.accept(products.getProductDetailsList().get(0));
                });
        });
    }

    @PluginMethod
    public void price(PluginCall call) {
        product(call, details -> {
            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
            if (offer == null) call.reject("El precio del pase no está disponible.");
            else call.resolve(new JSObject().put("formatted", offer.getFormattedPrice()));
        });
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("intentId", "");
        if (!id.matches("[a-f0-9-]{36}")) { call.reject("Solicitud inválida."); return; }
        product(call, details -> getActivity().runOnUiThread(() -> {
            if (checkout != null) { call.reject("Ya hay una compra en curso."); return; }
            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
            if (offer == null) { call.reject("El pase no está disponible."); return; }
            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details).setOfferToken(offer.getOfferToken()).build();
            checkout = call;
            BillingResult result = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(item)).setObfuscatedAccountId(id).build());
            if (!ok(result)) {
                checkout = null;
                call.reject("No se abrió el cobro. Consulta las compras pendientes.");
            }
        }));
    }

    private String intentId(Purchase purchase) {
        return purchase.getAccountIdentifiers() == null ? "" :
            purchase.getAccountIdentifiers().getObfuscatedAccountId();
    }

    private void updated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = checkout;
        checkout = null;
        if (call == null) return;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.resolve(new JSObject().put("status", "cancelled"));
            return;
        }
        if (ok(result) && purchases != null) {
            for (Purchase purchase : purchases) {
                if (!purchase.getProducts().contains(PRODUCT) || !call.getString("intentId", "").equals(intentId(purchase))) continue;
                String state = purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased" : "pending";
                call.resolve(new JSObject().put("status", state).put("token", purchase.getPurchaseToken()));
                return;
            }
        }
        call.reject("No se confirmó la compra. Consulta su estado.");
    }

    @PluginMethod
    public void pending(PluginCall call) {
        ready(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
                if (!ok(result)) { call.reject("No se pudieron consultar las compras."); return; }
                JSArray entries = new JSArray();
                for (Purchase purchase : purchases) {
                    String id = intentId(purchase);
                    if (purchase.getProducts().contains(PRODUCT) && id != null && !id.isEmpty())
                        entries.put(new JSObject().put("token", purchase.getPurchaseToken()).put("intentId", id));
                }
                call.resolve(new JSObject().put("purchases", entries));
            }));
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
    }
}
