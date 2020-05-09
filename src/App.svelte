<script>
  import Card from "./Card.svelte";
  import Footer from "./Footer.svelte";
  import Banner from "./Banner.svelte";
  import ErrorAlert from "./ErrorAlert.svelte";
  import { fade } from "svelte/transition";
  import Modal from "./Modal.svelte";
  let hasCharacters = false;
  let hasError = false;
  let modalIsOpen = false;
  let characters = [];
  let autofocus;
  let nextPage;
  let previousPage;
  let prevIsDisabled;
  let nextIsDisabled;
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
      setTimeout(() => {
        src = invertSrc;
        bgColor = invertBgColor;
      }, 1100);
      setTimeout(() => {
        src = originalSrc;
        bgColor = originalBgColor;
      }, 1200);
    }, 250);
  }

  function checkPages() {
    if (!nextPage || nextPage == "") {
      nextIsDisabled = true;
    } else {
      nextIsDisabled = false;
    }
    if (!previousPage || previousPage == "") {
      prevIsDisabled = true;
    } else {
      prevIsDisabled = false;
    }
  }

  function resetCharacters() {
    characters = [];
    hasCharacters = false;
    hasError = false;
    twitch();
  }

  async function getCharacters() {
    hasError = false;
    await fetch("https://rickandmortyapi.com/api/character/")
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function getNextPage() {
    await fetch(nextPage)
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function getPreviousPage() {
    await fetch(previousPage)
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function searchCharacters(event) {
    let characterName = !event.detail.characterName
      ? ""
      : event.detail.characterName;
    let characterStatus = !event.detail.characterStatus
      ? ""
      : event.detail.characterStatus;
    let characterSpecies = !event.detail.characterSpecies
      ? ""
      : event.detail.characterSpecies;
    let characterGender = !event.detail.characterGender
      ? ""
      : event.detail.characterGender;
    autofocus = "";
    hasError = false;
    await fetch(
      `https://rickandmortyapi.com/api/character/?name=${characterName}&status=${characterStatus}&species=${characterSpecies}&gender=${characterGender}`
    )
      .then(res => {
        if (res.ok) {
          hasCharacters = true;
          return res.json();
        } else {
          hasCharacters = false;
          hasError = true;
          return;
        }
      })
      .then(data => {
        if (hasCharacters) {
          characters = data.results;
          nextPage = data.info.next;
          previousPage = data.info.prev;
        }
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }
</script>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap");

  h3 {
    font-family: "Permanent Marker", cursive;
    text-align: center;
    padding: 0 1.5rem 0 1.5rem;
  }

  .container {
    margin: auto;
    margin-top: 2rem;
    width: 85%;
  }

  section {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    margin: auto;
  }

  section.margin-top {
    margin-top: -1rem;
  }

  button {
    margin: 0.5rem;
  }
  button:hover:enabled {
    color: rgba(141, 225, 86, 1);
    background-color: #333333;
  }

  @media (max-width: 592px) {
    section.bottom-nav {
      display: flex;
      flex-flow: row;
      justify-content: center;
      margin: auto;
      width: 95vw;
      margin-bottom: 1rem;
    }
  }
</style>

<Banner {src} {bgColor} on:mouseenter={twitch} />

<div class="container" transition:fade={{ duration: 700, delay: 500 }}>
  <section class="uk-margin-bottom" id="home">
    <button class="uk-button uk-button-default " on:click={getCharacters}>
      Get All Characters
    </button>
    <button
      class="uk-button uk-button-default margin-bottom"
      href="#search-modal"
      uk-toggle
      on:click={() => {
        hasError = false;
        modalIsOpen = true;
        autofocus = 'autofocus';
      }}>
      <i class="fas fa-search" />
      Search
    </button>
  </section>
</div>

<!-- Navigation and Clear characters -->
{#if hasCharacters}
  <hr
    in:fade={{ duration: 700, delay: 700 }}
    out:fade={{ duration: 700, delay: 0 }} />
  <section
    in:fade={{ duration: 700, delay: 700 }}
    out:fade={{ duration: 700, delay: 0 }}>
    {#if previousPage != '' || nextPage != ''}
      <button
        class="uk-button uk-button-default mainButton"
        on:click={getPreviousPage}
        disabled={prevIsDisabled}>
        <i class="fas fa-arrow-left" />
      </button>
      <button
        class="uk-button uk-button-default mainButton"
        on:click={getNextPage}
        disabled={nextIsDisabled}>
        <i class="fas fa-arrow-right" />
      </button>
    {/if}
    <button
      in:fade={{ delay: 700 }}
      out:fade={{ delay: 0 }}
      class="uk-button uk-button-default"
      on:click={resetCharacters}>
      Clear All Characters
    </button>
  </section>

  <!-- Loop through character cards -->
  <section
    class="margin-top"
    in:fade={{ duration: 700, delay: 700 }}
    out:fade={{ duration: 700, delay: 0 }}>
    {#each characters as character}
      <Card
        on:click
        name={character.name}
        status={character.status}
        species={character.species}
        gender={character.gender}
        origin={character.origin.name}
        image={character.image}
        statusClass={character.status == 'Dead' ? 'fas fa-skull-crossbones' : ''} />
    {/each}
  </section>
  <section
    in:fade={{ delay: 700 }}
    out:fade={{ delay: 0 }}
    class="uk-margin-bottom bottom-nav">
    {#if previousPage != '' || nextPage != ''}
      <button
        class="uk-button uk-button-default"
        on:click={getPreviousPage}
        on:click={() => (location.href = '#home')}
        disabled={prevIsDisabled}>
        <i class="fas fa-arrow-left" />
      </button>
      <button
        class="uk-button uk-button-default"
        on:click={getNextPage}
        on:click={() => (location.href = '#home')}
        disabled={nextIsDisabled}>
        <i class="fas fa-arrow-right" />
      </button>
    {/if}
  </section>
  <Footer positionClass={'relative'} />
{:else if hasCharacters || !hasError}
  <section
    in:fade={{ duration: 700, delay: 500 }}
    out:fade={{ duration: 700, delay: 0 }}>
    <h3>
      Search for your favorite Rick and Morty characters or Get All to browse.
    </h3>
  </section>
  {#if !modalIsOpen}
    <section
      in:fade={{ duration: 700, delay: 500 }}
      out:fade={{ duration: 0, delay: 0 }}>
      <Footer positionClass={'absolute'} />
    </section>
  {/if}
{/if}
<Modal
  {autofocus}
  on:searchCharacters={searchCharacters}
  on:closeModal={() => (modalIsOpen = false)} />

<!-- Error -->
{#if hasError}
  <section>
    <ErrorAlert on:click={() => (hasError = false)} />
  </section>
  <section
    in:fade={{ duration: 700, delay: 500 }}
    out:fade={{ duration: 0, delay: 0 }}>
    <Footer positionClass={'relative'} />
  </section>
{/if}
