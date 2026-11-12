package mx.edu.itssmt.sgpi;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Widget «Accesos rápidos»: hasta cuatro pantallas del perfil; se eligen al colocarlo. */
public class SgpiShortcutsWidget extends AppWidgetProvider {
    static final int MAX = 4;
    private static final int[] TILES = {R.id.shortcut1, R.id.shortcut2, R.id.shortcut3, R.id.shortcut4};
    private static final int[] LABELS = {R.id.shortcut_label1, R.id.shortcut_label2, R.id.shortcut_label3, R.id.shortcut_label4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetStore.forget(context, ids);
    }

    private static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget_shortcuts);
        JSONArray all = WidgetStore.array(WidgetStore.data(context), "shortcuts");
        String choice = WidgetStore.choice(context, widgetId);
        List<String> wanted = "auto".equals(choice) ? new ArrayList<>() : Arrays.asList(choice.split(","));
        List<JSONObject> shortcuts = new ArrayList<>();
        // Sólo los accesos que el perfil actual tiene; si cambió de perfil y ya no queda ninguno, los primeros.
        for (int index = 0; index < all.length(); index++) {
            JSONObject shortcut = all.optJSONObject(index);
            if (shortcut != null && (wanted.isEmpty() || wanted.contains(shortcut.optString("key")))) shortcuts.add(shortcut);
        }
        if (shortcuts.isEmpty()) for (int index = 0; index < all.length(); index++) shortcuts.add(all.optJSONObject(index));
        if (shortcuts.size() > MAX) shortcuts = shortcuts.subList(0, MAX);

        views.setViewVisibility(R.id.shortcuts_empty, shortcuts.isEmpty() ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.shortcuts_grid, shortcuts.isEmpty() ? View.GONE : View.VISIBLE);
        views.setOnClickPendingIntent(R.id.shortcuts_root, WidgetStore.open(context, "/dashboard", widgetId * 10));
        for (int index = 0; index < TILES.length; index++) {
            JSONObject shortcut = index < shortcuts.size() ? shortcuts.get(index) : null;
            views.setViewVisibility(TILES[index], shortcut == null ? View.INVISIBLE : View.VISIBLE);
            if (shortcut == null) continue;
            views.setTextViewText(LABELS[index], shortcut.optString("label"));
            views.setOnClickPendingIntent(TILES[index], WidgetStore.open(context, shortcut.optString("path", "/dashboard"), widgetId * 10 + index + 1));
        }
        views.setViewVisibility(R.id.shortcuts_row2, shortcuts.size() > 2 ? View.VISIBLE : View.GONE);
        return views;
    }
}
