package com.scrapsys.industrial;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private int bottomInsetCssPixels = 56;

    private void applyBottomInsetToWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        String script = "document.documentElement.style.setProperty('--android-system-bottom', '"
            + bottomInsetCssPixels
            + "px')";
        getBridge().getWebView().post(() ->
            getBridge().getWebView().evaluateJavascript(script, null)
        );
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setNavigationBarColor(Color.BLACK);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            bottomInsetCssPixels = bars.bottom > 0
                ? Math.max(1, Math.round(bars.bottom / density))
                : 56;
            view.setPadding(bars.left, bars.top, bars.right, 0);
            applyBottomInsetToWebView();
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
        applyBottomInsetToWebView();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyBottomInsetToWebView();
    }
}
