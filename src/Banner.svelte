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
  section {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    margin: auto;
  }
  /* .banner {
    width: 100%;
    margin: auto;
    justify-content: center;
    /* display: flex;
    flex-flow: row wrap;
    justify-content: center;
    align-content: center; */
  /* } */
</style>

<section>
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
</section>
