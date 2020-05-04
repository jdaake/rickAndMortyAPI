<script>
  import { fade } from "svelte/transition";
  export let hasError;
</script>

<style>
  h3 {
    font-family: "Permanent Marker", cursive;
  }
</style>

<div
  uk-alert
  in:fade={{ duration: 1500, delay: 1000 }}
  out:fade={{ duration: 0, delay: 0 }}>
  <span class="uk-alert-close" uk-close on:click={() => (hasError = false)} />
  <h3>No Characters Found!</h3>
  <p>There were no characters matching your criteria. Please try again.</p>
</div>
