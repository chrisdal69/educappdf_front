import React from "react";
import Anim1 from "../components/anim1";
import Anim2 from "../components/anim2";

function index() {
  return (
    <>
      <Anim1 />
      {false && <Anim2 />}
    </>
  );
}

export default index;
