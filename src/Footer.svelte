<script>
  export let positionClass;
</script>

<style>
  section.absolute {
    display: flex;
    flex-flow: row;
    justify-content: flex-end;
    margin: auto;
    width: 100vw;
    margin-bottom: 1rem;
    position: absolute;
    bottom: 0;
    right: 2%;
    align-items: baseline;
  }
  section.relative {
    display: flex;
    flex-flow: row;
    justify-content: flex-end;
    margin: auto;
    width: 100vw;
    margin-bottom: 1rem;
    position: relative;
    bottom: 0;
    right: 3%;
  }

  i {
    color: black;
    font-size: 2rem;
    margin: auto;
    text-align: center;
    padding: 0.5rem;
  }
</style>

<section class={positionClass}>
  <a href="https://github.com/jdaake/rickAndMortyAPI" target="_blank">
    <i class="fab fa-github" />
  </a>
  <a href="https://www.instagram.com/j.daake/" target="_blank">
    <i class="fab fa-instagram" />
  </a>
  <a href="https://www.twitter.com/jdaake" target="_blank">
    <i class="fab fa-twitter" />
  </a>
  <a href="https://www.linkedin.com/in/jdaake" target="_blank">
    <i class="fab fa-linkedin" />
  </a>
</section>
