# REACT-DND-DICE-COMPONENTS

Dungeons and Dragons Dice Components

This repository contains a set of interactive, animated dice components designed for a Dungeons and Dragons (D&D) themed web application. The dice are built using React and Three.js, and are fully customizable for different types of dice (D4, D6, D8, D10, D12, and D20). The dice components include features like rolling, bouncing, and showing the final result face to the camera.

Features:

Realistic Dice Animations: Each die rolls, bounces, and settles on the correct face.

Multiple Dice Types: D4, D6, D8, D10, D12, and D20 with customizable textures and animations.

Customizable Roll Logic: Easily configure dice to match different D&D abilities or other games.

Dice Textures: Dynamic number generation with smooth textures for each dice face.

Smooth Rotation and Centering: Dice return to the center of the screen with the correct result face facing the camera.

Dice Roll Animation: Rolling animation simulates randomness and natural dice behavior.

Installation

To use these dice components in your project, follow the steps below:

1. Clone this Repository
git clone https://github.com/your-username/dnd-dice-components.git
cd dnd-dice-components

2. Install Dependencies

Ensure you have Node.js and npm (or yarn) installed. Then run the following command to install the required dependencies:

npm install


or

yarn install

3. Start the Development Server

After installation, you can run the development server to preview the dice components:

npm start


This will run the app at http://localhost:3000 and display your dice components in action.

Usage

You can use the dice components in your project by importing them like this:

import D4 from './path-to-dice-components/D4';
import D6 from './path-to-dice-components/D6';
import D8 from './path-to-dice-components/D8';
import D10 from './path-to-dice-components/D10';
import D12 from './path-to-dice-components/D12';
import D20 from './path-to-dice-components/D20';

// Example usage in a component:
function DiceRoller() {
  const handleRollComplete = (result) => {
    console.log('Roll Result: ', result);
  };

  return (
    <div>
      <h2>Roll Your D4!</h2>
      <D4 onRollComplete={handleRollComplete} />
      <h2>Roll Your D6!</h2>
      <D6 onRollComplete={handleRollComplete} />
      {/* Add other dice as needed */}
    </div>
  );
}

Dice Types:

D4: Four-sided die, typically a pyramid shape.

D6: Six-sided die, the classic cube.

D8: Eight-sided die, shaped like an octahedron.

D10: Ten-sided die, shaped like a pentagonal trapezohedron.

D12: Twelve-sided die, shaped like an icosahedron.

D20: Twenty-sided die, shaped like an icosahedron.

Each dice component uses Three.js for 3D rendering and React hooks for interactivity.

Customization

You can easily customize the dice in the following ways:

Change Dice Colors: Adjust the background color and text color using the makeNumberTexture function in each dice component.

Update Dice Faces: Modify the number of faces by changing the geometry and materials.

Dice Roll Animation: Adjust the speed of the roll and the bounce intensity by modifying the constants in each dice component (e.g., ROLL_DURATION_MS, BOUNCE_DAMPING).

Contributing

Contributions are welcome! If you’d like to add new features, fix bugs, or improve existing functionality, please feel free to fork the repo and submit a pull request.

License

This project is licensed under the MIT License - see the LICENSE
 file for details.

Acknowledgements

Three.js: A 3D graphics library used for rendering the dice.

React: A JavaScript library for building user interfaces.

Dungeons and Dragons: This repository is inspired by the fantasy world of Dungeons and Dragons
