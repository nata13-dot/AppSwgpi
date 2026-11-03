package mx.edu.itssmt.sgpi;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.Key;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;

/**
 * Bloqueo de la app con el método del propio teléfono: huella, rostro, PIN, patrón o contraseña.
 * El sistema hace la verificación; la app sólo recibe si fue correcta y nunca ve esos datos.
 *
 * Android no avisa de cambios en las huellas, pero invalida para siempre una llave creada con
 * setInvalidatedByBiometricEnrollment al agregar una huella o borrarlas todas. Esa llave no cifra nada:
 * sólo sirve de testigo. Cambiar el PIN o borrar una sola huella de varias no se puede detectar.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
    private static final int AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "sgpi_biometric_witness";
    private static final String TRANSFORMATION = KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_CBC + "/" + KeyProperties.ENCRYPTION_PADDING_PKCS7;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("sgpi_app_lock", Context.MODE_PRIVATE);
    }

    private boolean hasStrongBiometric() {
        return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** Crea el testigo con las huellas actuales. Sin huellas registradas no se puede crear: se recuerda para notar la primera. */
    @PluginMethod
    public void prepare(PluginCall call) {
        boolean tracking = false;
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            store.deleteEntry(KEY_ALIAS);
            if (hasStrongBiometric()) {
                KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
                generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT)
                        .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
                        .setUserAuthenticationRequired(true)
                        .setInvalidatedByBiometricEnrollment(true)
                        .build());
                generator.generateKey();
                tracking = true;
            }
        } catch (Exception exception) {
            // Algunos fabricantes fallan aquí: el desbloqueo sigue funcionando, sólo sin esta detección.
            tracking = false;
        }
        preferences().edit().putBoolean("prepared", true).putBoolean("tracking", tracking).apply();
        JSObject result = new JSObject();
        result.put("tracking", tracking);
        call.resolve(result);
    }

    /** ok | changed | unprepared. No pide verificar a la persona: el error salta al preparar el cifrado. */
    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", witnessState());
        call.resolve(result);
    }

    private String witnessState() {
        SharedPreferences preferences = preferences();
        if (!preferences.getBoolean("prepared", false)) return "unprepared";
        if (!preferences.getBoolean("tracking", false)) {
            // Se activó sin huellas: si ahora hay alguna, alguien la agregó después.
            return hasStrongBiometric() ? "changed" : "ok";
        }
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            Key key = store.getKey(KEY_ALIAS, null);
            if (key == null) return "changed";
            Cipher.getInstance(TRANSFORMATION).init(Cipher.ENCRYPT_MODE, key);
            return "ok";
        } catch (KeyPermanentlyInvalidatedException exception) {
            return "changed";
        } catch (Exception exception) {
            // Un fallo del almacén de llaves no es un cambio de huellas: no se saca a nadie por eso.
            return "ok";
        }
    }

    @PluginMethod
    public void reset(PluginCall call) {
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            store.deleteEntry(KEY_ALIAS);
        } catch (Exception exception) {
            // Si no se pudo borrar, la siguiente activación la reemplaza.
        }
        preferences().edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS) != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("El teléfono no tiene bloqueo de pantalla configurado.", "UNAVAILABLE");
            return;
        }
        BiometricPrompt.PromptInfo prompt = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(call.getString("title", "Desbloquear SGPI"))
                .setSubtitle(call.getString("subtitle", "Usa tu huella, rostro o el bloqueo de tu teléfono"))
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build();

        FragmentActivity activity = getActivity();
        activity.runOnUiThread(() -> new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                call.resolve();
            }

            @Override
            public void onAuthenticationError(int code, CharSequence message) {
                // Un dedo no reconocido no llega aquí: el propio diálogo deja reintentar.
                boolean canceled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                call.reject(message.toString(), canceled ? "CANCELED" : "FAILED");
            }
        }).authenticate(prompt));
    }
}
