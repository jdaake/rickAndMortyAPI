<script>
  let src = "assets/banner.png";
  import { fade } from "svelte/transition";
</script>

<style>
  .banner {
    width: 100%;
    background-color: black;
  }
</style>

<div class="banner" transition:fade={{ duration: 700, delay: 500 }}>
  <img {src} alt="Rick and Morty" />
</div>
