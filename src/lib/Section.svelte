<script>
	let { title, children } = $props();
</script>

<section>
	<h2>{title}</h2>
	{@render children()}
</section>

<style>
	section {
		margin: 3rem 0;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 500;
		margin: 0 0 1rem 0;
	}
</style>
