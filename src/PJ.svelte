<script>
  import Card from "./card.svelte";
  import { fade } from "svelte/transition";
  import { albums } from "./shared/albums";
  let pjAlbums = albums;
  let hasAlbums = false;
  let showTracks = false;

  function getAlbums() {
    hasAlbums = true;
  }
  function resetAlbums() {
    hasAlbums = false;
  }
</script>

<div class="container">
  <section class="uk-margin-bottom">
    <button
      class="uk-button uk-button-default uk-margin-right"
      on:click={getAlbums}>
      Get Pearl Jam Albums
    </button>
    <button class="uk-button uk-button-default" on:click={resetAlbums}>
      Reset
    </button>
  </section>
</div>

{#if hasAlbums}
  <section>
    {#each pjAlbums as album, i}
      <Card
        on:click={e => (showTracks = true)}
        name={album.artist}
        misc={album.title}
        imgUrl={album.imgUrl}
        linkImage={album.imgUrl} />
    {/each}
  </section>
{:else}
  <section>
    <h3>No Albums Found</h3>
  </section>
{/if}
