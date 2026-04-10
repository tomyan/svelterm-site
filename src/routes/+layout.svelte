<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		background: #0d1117;
		color: #e6edf3;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		line-height: 1.6;
	}

	:global(a) {
		color: #58a6ff;
		text-decoration: none;
	}

	:global(a:hover) {
		text-decoration: underline;
	}
</style>
