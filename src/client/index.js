import Game from './Game';

// Initialize the game once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
