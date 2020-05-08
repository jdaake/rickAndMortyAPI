<script>
  import { fade } from "svelte/transition";
  let src = "assets/banner.png";
  let bgColor = "background-color:black;";
  let originalBgColor = "background-color:black;";
  let originalSrc = "assets/banner.png";
  let invertBgColor = "background-color:white;";
  let invertSrc = "assets/invertRotateBanner.png";

  function twitch() {
    setTimeout(() => {
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
    }, 250);
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

<section style={bgColor} transition:fade={{ duration: 700, delay: 500 }}>
  <div on:mouseenter={twitch} class="banner">
    <img {src} style={bgColor} alt="Rick and Morty" />
  </div>
</section>
