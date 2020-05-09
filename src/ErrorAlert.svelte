<script>
  import { fade } from "svelte/transition";
</script>

<style>
  h2 {
    font-family: "Permanent Marker", cursive;
    text-align: center;
  }
  p {
    text-align: center;
    font-family: monospace;
    font-size: 1.2rem;
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
  in:fade={{ duration: 700, delay: 700 }}
  out:fade={{ duration: 700, delay: 0 }}>
  <span class="uk-alert-close" uk-close on:click />
  <h2>No Characters Found!</h2>
  <p>There were no characters matching your criteria. Please try again.</p>
  <section>
    <img class="uk-padding-left" src="assets/rick.gif" alt="" />
  </section>
</div>
