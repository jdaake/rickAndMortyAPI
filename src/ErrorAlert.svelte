<script>
  import { fade } from "svelte/transition";
  export let hasError;
</script>

<style>
  h3 {
    font-family: "Permanent Marker", cursive;
    text-align: center;
  }
  p {
    text-align: center;
  }
  img {
    min-width: 300px;
  }
  section {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    margin: auto;
  }
</style>

<div
  class="uk-background-default"
  uk-alert
  in:fade={{ duration: 1500, delay: 1000 }}
  out:fade={{ duration: 0, delay: 0 }}>
  <span class="uk-alert-close" uk-close on:click={() => (hasError = false)} />
  <h3>No Characters Found!</h3>
  <p>There were no characters matching your criteria. Please try again.</p>
  <section>
    <img
      class="uk-padding-left"
      src="https://media.giphy.com/media/3ov9k1ZNTELhynEI2A/giphy.gif"
      alt="" />
  </section>
</div>
