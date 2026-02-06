import React, { useState } from "react";
import Anim1 from "../components/anim1";
import Anim2 from "../components/anim2";

function index() {
  const [showAnim2, setShowAnim2] = useState(false);
  const [letterPositions, setLetterPositions] = useState(null);

  return (
    <>
      {!showAnim2 ? (
        <Anim1
          onLoginTransitionComplete={(positions) => {
            setLetterPositions(positions);
            setShowAnim2(true);
          }}
        />
      ) : (
        <Anim2 initialPositions={letterPositions} />
      )}
    </>
  );
}

export default index;
