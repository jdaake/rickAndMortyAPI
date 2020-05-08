<script>
  import { fade } from "svelte/transition";
  export let src = "assets/banner.png";
  export let bgColor = "background-color:black;";
</script>

<style>
  section {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    margin: auto;
  }
</style>

<section style={bgColor} transition:fade={{ duration: 700, delay: 500 }}>
  <div on:mouseenter>
    <img {src} style={bgColor} alt="Rick and Morty" />
  </div>
</section>
