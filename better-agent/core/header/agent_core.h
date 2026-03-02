#ifndef AGENT_CORE_H
#define AGENT_CORE_H

/* ── Export macro ─────────────────────────────────────────────────────────── */
#ifdef AGENT_CORE_EXPORTS
    #define AGENT_CORE_API __attribute__((visibility("default")))
#else
    #define AGENT_CORE_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* ── Lifecycle ───────────────────────────────────────────────────────────── */
AGENT_CORE_API int agent_core_init(void);
AGENT_CORE_API void agent_core_shutdown(void);

/* ── Version info ────────────────────────────────────────────────────────── */
AGENT_CORE_API const char *agent_core_version(void);

#ifdef __cplusplus
}
#endif

#endif /* AGENT_CORE_H */
