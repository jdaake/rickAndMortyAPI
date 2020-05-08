<script>
  let src = "assets/banner.png";
  let bgColor = "background-color:black;";
  let originalBgColor = "background-color:black;";
  let originalSrc = "assets/banner.png";
  let invertBgColor = "background-color:white;";
  let invertSrc = "assets/invertRotateBanner.png";

  import { fade } from "svelte/transition";

  function twitch() {
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 100);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 200);
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 300);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 400);
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 500);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 600);
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 700);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 800);
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 900);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 1000);
    setTimeout(() => {
      src = invertSrc;
      bgColor = invertBgColor;
    }, 1100);
    setTimeout(() => {
      src = originalSrc;
      bgColor = originalBgColor;
    }, 1200);
  }
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

<section style={bgColor}>
  <div
    on:mouseenter={twitch}
    class="banner"
    transition:fade={{ duration: 700, delay: 500 }}>
    <img {src} style={bgColor} alt="Rick and Morty" />
  </div>
</section>
