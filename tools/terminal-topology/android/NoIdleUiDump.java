import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;

import java.io.BufferedWriter;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

/**
 * Dumps the focused accessibility tree without the stock shell command's
 * waitForIdle(1s, 10s) gate.
 *
 * The stock `uiautomator dump` command creates a UiAutomation connection and
 * waits for the whole device to become idle before reading the tree. React
 * surface transitions can keep that global idle condition false even after
 * the requested screen is visible. This helper retains the same shell-side
 * UiAutomation boundary, but reads the active root directly and serializes
 * only public AccessibilityNodeInfo data needed by the runner.
 */
public final class NoIdleUiDump {
    private NoIdleUiDump() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && "--server".equals(args[0])) {
            runServer();
            return;
        }
        if (args.length != 2) {
            System.err.println("usage: NoIdleUiDump <output-path> <rotation> | --server");
            System.exit(2);
            return;
        }

        final File output = new File(args[0]);
        final int rotation = Integer.parseInt(args[1]);
        final Object wrapper = connectWrapper();
        try {
            dump(wrapper, output, rotation);
            System.out.println("NO_IDLE_UI_DUMP_OK");
        } catch (InvocationTargetException error) {
            final Throwable cause = error.getCause() == null ? error : error.getCause();
            throw new IllegalStateException(cause.getMessage(), cause);
        } finally {
            disconnectWrapper(wrapper);
        }
    }

    private static void runServer() throws Exception {
        final Object wrapper = connectWrapper();
        final BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        try {
            String command;
            while ((command = input.readLine()) != null) {
                final String trimmed = command.trim();
                if (trimmed.length() == 0) {
                    continue;
                }
                final String[] fields = trimmed.split("\\t", -1);
                if (fields.length != 2) {
                    System.out.println("NO_IDLE_UI_DUMP_ERROR\tinvalid-command");
                    System.out.flush();
                    continue;
                }
                try {
                    dump(wrapper, new File(fields[0]), Integer.parseInt(fields[1]));
                    System.out.println("NO_IDLE_UI_DUMP_OK");
                } catch (InvocationTargetException error) {
                    final Throwable cause = error.getCause() == null ? error : error.getCause();
                    System.out.println("NO_IDLE_UI_DUMP_ERROR\t" + sanitizeError(cause));
                } catch (Exception error) {
                    System.out.println("NO_IDLE_UI_DUMP_ERROR\t" + sanitizeError(error));
                }
                System.out.flush();
            }
        } finally {
            disconnectWrapper(wrapper);
        }
    }

    private static Object connectWrapper() throws Exception {
        final Class<?> wrapperClass = Class.forName(
                "com.android.uiautomator.core.UiAutomationShellWrapper");
        final Object wrapper = wrapperClass.getConstructor().newInstance();
        wrapperClass.getMethod("connect").invoke(wrapper);
        return wrapper;
    }

    private static void disconnectWrapper(Object wrapper) {
        if (wrapper == null) {
            return;
        }
        try {
            wrapper.getClass().getMethod("disconnect").invoke(wrapper);
        } catch (Exception disconnectError) {
            System.err.println("disconnect failed: " + disconnectError.getMessage());
        }
    }

    private static void dump(Object wrapper, File output, int rotation) throws Exception {
        final Class<?> wrapperClass = wrapper.getClass();
        final Object automation = wrapperClass.getMethod("getUiAutomation").invoke(wrapper);
        // A persistent UiAutomation connection keeps an interaction cache.  A
        // fresh stock `uiautomator dump` clears that cache as a side effect of
        // reconnecting, but the runner deliberately keeps one connection open
        // to avoid the global waitForIdle gate.  Clear the public cache before
        // every read so a previous accessibility tree cannot masquerade as a
        // current app state after a real tap or React update.  API 33+ exposes
        // this method; older images fall back to the root refresh below.
        try {
            automation.getClass().getMethod("clearCache").invoke(automation);
        } catch (NoSuchMethodException ignored) {
            // The helper remains usable on older API levels.
        }
        final Method rootMethod = automation.getClass().getMethod("getRootInActiveWindow");
        AccessibilityNodeInfo root = null;
        for (int attempt = 0; attempt < 30 && root == null; attempt++) {
            root = (AccessibilityNodeInfo) rootMethod.invoke(automation);
            if (root == null && attempt < 29) {
                Thread.sleep(100L);
            }
        }
        if (root == null) {
            throw new IllegalStateException("active accessibility root is null");
        }
        root.refresh();
        writeXml(output, rotation, root);
    }

    private static String sanitizeError(Throwable error) {
        final String message = error.getMessage() == null ? error.getClass().getName() : error.getMessage();
        return message.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ');
    }

    private static void writeXml(File output, int rotation, AccessibilityNodeInfo root) throws Exception {
        final File parent = output.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IllegalStateException("cannot create output directory: " + parent);
        }

        final FileOutputStream stream = new FileOutputStream(output, false);
        final BufferedWriter writer = new BufferedWriter(
                new OutputStreamWriter(stream, StandardCharsets.UTF_8));
        try {
            writer.write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\" ?>");
            writer.write("<hierarchy rotation=\"");
            writer.write(Integer.toString(rotation));
            writer.write("\">");
            appendNode(writer, root, 0);
            writer.write("</hierarchy>");
        } finally {
            writer.close();
        }
    }

    private static void appendNode(BufferedWriter writer, AccessibilityNodeInfo node, int index)
            throws Exception {
        // `UiAutomation.clearCache()` refreshes the connection-level cache, but
        // a node subtree obtained from the active root can still contain cached
        // descendants on some Android images.  Refresh every node immediately
        // before reading its state so a post-action dump cannot report the
        // pre-action checked/text/enabled values from a stale descendant.
        try {
            node.refresh();
        } catch (RuntimeException ignored) {
            // Keep serializing the node when an individual accessibility
            // provider cannot refresh it; the next dump remains bounded.
        }
        final Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        writer.write("<node index=\"");
        writer.write(Integer.toString(index));
        writer.write("\" text=\"");
        writeEscaped(writer, node.getText());
        writer.write("\" resource-id=\"");
        writeEscaped(writer, node.getViewIdResourceName());
        writer.write("\" class=\"");
        writeEscaped(writer, node.getClassName());
        writer.write("\" package=\"");
        writeEscaped(writer, node.getPackageName());
        writer.write("\" content-desc=\"");
        writeEscaped(writer, node.getContentDescription());
        writer.write("\" checkable=\"");
        writer.write(Boolean.toString(node.isCheckable()));
        writer.write("\" checked=\"");
        writer.write(Boolean.toString(node.isChecked()));
        writer.write("\" clickable=\"");
        writer.write(Boolean.toString(node.isClickable()));
        writer.write("\" enabled=\"");
        writer.write(Boolean.toString(node.isEnabled()));
        writer.write("\" focusable=\"");
        writer.write(Boolean.toString(node.isFocusable()));
        writer.write("\" focused=\"");
        writer.write(Boolean.toString(node.isFocused()));
        writer.write("\" scrollable=\"");
        writer.write(Boolean.toString(node.isScrollable()));
        writer.write("\" long-clickable=\"");
        writer.write(Boolean.toString(node.isLongClickable()));
        writer.write("\" password=\"");
        writer.write(Boolean.toString(node.isPassword()));
        writer.write("\" selected=\"");
        writer.write(Boolean.toString(node.isSelected()));
        writer.write("\" bounds=\"[");
        writer.write(Integer.toString(bounds.left));
        writer.write(",");
        writer.write(Integer.toString(bounds.top));
        writer.write("][");
        writer.write(Integer.toString(bounds.right));
        writer.write(",");
        writer.write(Integer.toString(bounds.bottom));
        writer.write("]\">");

        final int childCount = node.getChildCount();
        for (int childIndex = 0; childIndex < childCount; childIndex++) {
            final AccessibilityNodeInfo child = node.getChild(childIndex);
            if (child != null) {
                appendNode(writer, child, childIndex);
            }
        }
        writer.write("</node>");
    }

    private static void writeEscaped(BufferedWriter writer, CharSequence value) throws Exception {
        if (value == null) {
            return;
        }
        final String text = value.toString();
        for (int index = 0; index < text.length(); index++) {
            final char character = text.charAt(index);
            if (character == '&') {
                writer.write("&amp;");
            } else if (character == '<') {
                writer.write("&lt;");
            } else if (character == '>') {
                writer.write("&gt;");
            } else if (character == '"') {
                writer.write("&quot;");
            } else if (character == '\'') {
                writer.write("&apos;");
            } else {
                writer.write(character);
            }
        }
    }
}
