<script setup lang="ts">
defineEmits(['close']);
</script>

<template>
  <div class="help-overlay" @click.self="$emit('close')">
    <div class="help-modal">
      <button class="close-btn" @click="$emit('close')">&times;</button>

      <h2>How to Play WhoDat</h2>

      <section>
        <h3>Objective</h3>
        <p>
          Each player is secretly assigned a real identity — a famous person, animal, country, or landmark.
          You can see everyone else's identity but not your own. Figure out who you are before anyone else does!
        </p>
      </section>

      <section>
        <h3>Turn Order</h3>
        <ol>
          <li>On your turn you choose to either <strong>Ask a Question</strong> or <strong>Make a Guess</strong>.</li>
          <li>Questions must be answerable with <strong>Yes</strong> or <strong>No</strong>.</li>
          <li>The AI reads the Wikipedia article for your secret identity and answers automatically.</li>
          <li>If your guess is correct you win the round. If not, play passes to the next player.</li>
        </ol>
      </section>

      <section>
        <h3>Winning</h3>
        <p>The first player to correctly guess their own secret identity wins.</p>
      </section>

      <section>
        <h3>Voting to End</h3>
        <p>
          During a game, any human player can click <strong>Vote to End Game</strong>.
          If more than half of the human players vote, the game ends immediately with no winner
          and all identities are revealed.
        </p>
      </section>

      <section>
        <h3>Custom Identities</h3>
        <p>
          The host can paste a list of names into the <em>Custom Identities</em> box in the lobby
          (one per line or comma-separated). The game will use those names instead of the default
          Wikipedia categories. The backend still tries to pull a Wikipedia article for each name
          so questions are answered accurately.
        </p>
      </section>

      <section>
        <h3>AI Bots</h3>
        <p>Add bots to fill empty slots. Each has a different play style:</p>
        <table>
          <thead>
            <tr><th>Persona</th><th>Style</th></tr>
          </thead>
          <tbody>
            <tr><td>Standard</td><td>Balanced and strategic</td></tr>
            <tr><td>Sherlock</td><td>Highly logical, deduces quickly</td></tr>
            <tr><td>Joker</td><td>Chaotic but secretly clever</td></tr>
            <tr><td>Toddler</td><td>Simple questions, enthusiastic guesses</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>Tips</h3>
        <ul>
          <li>Start broad — "Am I a person?", "Am I alive?" — then narrow down.</li>
          <li>Watch other players' questions; their answers give you clues too.</li>
          <li>Guess early once you're fairly confident — someone else might beat you to it.</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1rem;
}
.help-modal {
  background: var(--surface-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 2rem 2.25rem;
  max-width: 680px;
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  position: relative;
}
.close-btn {
  position: absolute;
  top: 1rem;
  right: 1.25rem;
  background: transparent;
  border: none;
  font-size: 1.8rem;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
}
.close-btn:hover { color: var(--text-primary); }
h2 {
  color: var(--primary-color);
  font-size: 1.6rem;
  margin: 0 0 1.5rem;
}
h3 {
  color: var(--primary-color);
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 0.5rem;
}
section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}
section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
p, li { color: var(--text-secondary); line-height: 1.6; font-size: 0.93rem; }
ol, ul { padding-left: 1.25rem; margin: 0.25rem 0 0; }
li { margin-bottom: 0.35rem; }
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
th, td {
  text-align: left;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
th { background: var(--bg-color); color: var(--text-primary); font-weight: 600; }
</style>
