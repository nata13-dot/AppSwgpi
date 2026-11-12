package mx.edu.itssmt.sgpi;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Se abre al colocar (o reconfigurar) un widget para elegir qué muestra: el pendiente principal, la fecha de la
 * cuenta regresiva o los accesos rápidos. Las opciones salen del último resumen que guardó la app.
 */
public class WidgetConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Si se cierra sin elegir, Android no coloca el widget.
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
        String provider = info == null ? "" : info.provider.getClassName();
        JSONObject data = WidgetStore.data(this);
        String current = WidgetStore.choice(this, widgetId);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        layout.setPadding(pad, pad, pad, dp(12));
        TextView title = text("", 18, true);
        TextView hint = text("", 13, false);
        hint.setPadding(0, dp(4), 0, dp(12));
        layout.addView(title);
        layout.addView(hint);
        if (data == null) {
            hint.setText("Abre SGPI e inicia sesión para ver las opciones de tu perfil. Mientras tanto se mostrará lo más importante.");
        }

        final Runnable save;
        if (provider.endsWith("SgpiShortcutsWidget")) {
            title.setText("Accesos rápidos");
            if (data != null) hint.setText("Elige hasta " + SgpiShortcutsWidget.MAX + " pantallas.");
            List<String> chosen = "auto".equals(current) ? new ArrayList<>() : Arrays.asList(current.split(","));
            JSONArray shortcuts = WidgetStore.array(data, "shortcuts");
            List<CheckBox> boxes = new ArrayList<>();
            for (int index = 0; index < shortcuts.length(); index++) {
                JSONObject shortcut = shortcuts.optJSONObject(index);
                CheckBox box = new CheckBox(this);
                box.setText(shortcut.optString("label"));
                box.setTag(shortcut.optString("key"));
                box.setChecked(chosen.isEmpty() ? index < SgpiShortcutsWidget.MAX : chosen.contains(shortcut.optString("key")));
                box.setOnCheckedChangeListener((view, checked) -> {
                    if (checked && boxes.stream().filter(CheckBox::isChecked).count() > SgpiShortcutsWidget.MAX) {
                        view.setChecked(false);
                        Toast.makeText(this, "Máximo " + SgpiShortcutsWidget.MAX + " accesos.", Toast.LENGTH_SHORT).show();
                    }
                });
                boxes.add(box);
                layout.addView(box);
            }
            save = () -> {
                List<String> keys = new ArrayList<>();
                for (CheckBox box : boxes) if (box.isChecked()) keys.add((String) box.getTag());
                WidgetStore.setChoice(this, widgetId, keys.isEmpty() ? "auto" : android.text.TextUtils.join(",", keys));
            };
        } else {
            boolean countdown = provider.endsWith("SgpiCountdownWidget");
            title.setText(countdown ? "Cuenta regresiva" : "Pendiente principal");
            if (data != null) hint.setText(countdown ? "¿Para qué fecha quieres la cuenta regresiva?" : "¿Qué dato quieres ver en grande?");
            RadioGroup group = new RadioGroup(this);
            addOption(group, "auto", countdown ? "La fecha más cercana" : "Automático (lo más importante)", current);
            JSONArray options = WidgetStore.array(data, countdown ? "countdown_options" : "items");
            for (int index = 0; index < options.length(); index++) {
                JSONObject option = options.optJSONObject(index);
                if (option != null) addOption(group, option.optString("key"), option.optString("label"), current);
            }
            layout.addView(group);
            save = () -> {
                RadioButton checked = group.findViewById(group.getCheckedRadioButtonId());
                WidgetStore.setChoice(this, widgetId, checked == null ? "auto" : (String) checked.getTag());
            };
        }

        Button done = new Button(this);
        done.setText("Listo");
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(12);
        layout.addView(done, params);
        done.setOnClickListener(view -> {
            save.run();
            WidgetStore.refreshAll(this);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
            finish();
        });

        ScrollView scroll = new ScrollView(this);
        scroll.addView(layout);
        setContentView(scroll);
    }

    private void addOption(RadioGroup group, String key, String label, String current) {
        RadioButton button = new RadioButton(this);
        button.setId(android.view.View.generateViewId());
        button.setText(label);
        button.setTag(key);
        group.addView(button);
        if (key.equals(current)) button.setChecked(true);
    }

    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
