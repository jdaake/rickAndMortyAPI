<script>
  export let src = "assets/banner.png";
  export let bgColor = "background-color:black;";
  import { fade } from "svelte/transition";
</script>

<style>
  .banner {
    width: 100%;
    margin: auto;
    /* background-color: black; */
  }
</style>

<div
  on:mouseenter
  on:mouseleave
  class="banner"
  transition:fade={{ duration: 700, delay: 500 }}>
  <img {src} style={bgColor} alt="Rick and Morty" />
</div>
