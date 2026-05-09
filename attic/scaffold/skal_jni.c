// Minimal JNI entry for libskal.so. Bun's runtime initialization is
// designed for `main()` invocation; for a true embeddable build we'll
// later expose a stable C ABI from bun's Zig side. This entry-point is
// a placeholder so the .so links and the symbols are present for Java.

#include <jni.h>
#include <stddef.h>
#include <android/log.h>
#include <string.h>

#define LOGI(fmt, ...) __android_log_print(ANDROID_LOG_INFO, "Skal", fmt, ##__VA_ARGS__)
#define LOGE(fmt, ...) __android_log_print(ANDROID_LOG_ERROR, "Skal", fmt, ##__VA_ARGS__)

JNIEXPORT jint JNICALL
JNI_OnLoad(JavaVM *vm, void *reserved) {
    (void)reserved;
    JNIEnv *env;
    if ((*vm)->GetEnv(vm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) {
        return JNI_ERR;
    }
    LOGI("Skal libskal.so loaded (bun-derived runtime, aarch64-linux-android)");
    return JNI_VERSION_1_6;
}

// Forward-declared placeholders. Real implementations require exposing bun's
// VirtualMachine + JSGlobalObject + JSEvaluateScript through a stable C ABI.
// For now these are stubs so the symbol table matches Skal.java's expectations.

JNIEXPORT jlong JNICALL
Java_com_skal_Skal_nativeCreateRuntime(JNIEnv *env, jclass clazz) {
    (void)env; (void)clazz;
    LOGI("nativeCreateRuntime called (stub) — full bun init pending");
    return 0;
}

JNIEXPORT void JNICALL
Java_com_skal_Skal_nativeDisposeRuntime(JNIEnv *env, jclass clazz, jlong handle) {
    (void)env; (void)clazz; (void)handle;
}

JNIEXPORT jstring JNICALL
Java_com_skal_Skal_nativeEvaluate(JNIEnv *env, jclass clazz, jlong handle, jstring source, jstring url) {
    (void)clazz; (void)handle; (void)source; (void)url;
    return (*env)->NewStringUTF(env, "(skal: evaluate not yet wired through to bun runtime)");
}
