<script>
  export let src = "assets/banner.png";
  export let bgColor = "background-color:black;";
  let originalBgColor = "background-color:black;";
  let invertBgColor = "background-color:white;";
  let originalSrc = "assets/banner.png";
  let invertSrc = "assets/invertRotateBanner.png";
  import { fade } from "svelte/transition";
</script>

<style>
  .banner {
    width: 100vw;
    margin: auto;
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    align-content: center;
    /* background-color: black; */
  }
</style>

<div
  on:mouseenter={() => {
    bgColor = invertBgColor;
    src = invertSrc;
  }}
  on:mouseleave={() => {
    bgColor = originalBgColor;
    src = originalSrc;
  }}
  class="banner"
  transition:fade={{ duration: 700, delay: 500 }}>
  <img {src} style={bgColor} alt="Rick and Morty" />
</div>
