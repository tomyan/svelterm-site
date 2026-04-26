<script lang="ts">
    import type { Component } from 'svelte'

    let launched = $state(false)
    let loading = $state(false)
    let Shell: Component | null = $state(null)

    async function launch() {
        if (launched || loading) return
        loading = true
        try {
            const mod = await import('./Shell.svelte')
            Shell = mod.default as Component
            launched = true
        } finally {
            loading = false
        }
    }
</script>

<div class="shell-launch">
    {#if !launched}
        <button class="launch-button" onclick={launch} disabled={loading}>
            {loading ? 'Loading…' : 'Launch shell'}
        </button>
        <p class="hint">
            Boots a real Linux (buildroot, ~5MB) in-browser via v86, piped through the vt100 renderer.
        </p>
    {:else if Shell}
        <div class="shell-frame">
            <Shell />
        </div>
    {/if}
</div>

<style>
    .shell-launch {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    .launch-button {
        padding: 0.6rem 1.2rem;
        font-size: 0.95rem;
        font-weight: 600;
        border: 1px solid var(--fg, #cccccc);
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
    }
    .launch-button:hover:not(:disabled) {
        background: var(--fg, #cccccc);
        color: var(--bg, #000);
    }
    .launch-button:disabled {
        opacity: 0.6;
        cursor: wait;
    }
    .hint {
        font-size: 0.8rem;
        opacity: 0.7;
        margin: 0;
    }
    .shell-frame {
        width: 100%;
        max-width: 960px;
        aspect-ratio: 80 / 26;
        border: 1px solid var(--fg, #333);
        border-radius: 4px;
        overflow: hidden;
    }
</style>
