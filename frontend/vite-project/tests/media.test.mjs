import assert from "node:assert/strict";
import { test } from "node:test";
import { attachStreamToVideo } from "../src/lib/media.js";

function createVideoElement() {
  return {
    srcObject: null,
    muted: false,
    playCalls: 0,
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    },
  };
}

test("attachStreamToVideo attaches a stream to an element that mounted later", () => {
  const video = createVideoElement();
  const stream = { id: "local-stream" };

  assert.equal(attachStreamToVideo(video, stream, { muted: true }), true);
  assert.equal(video.srcObject, stream);
  assert.equal(video.muted, true);
  assert.equal(video.playCalls, 1);
});

test("attachStreamToVideo does not reassign the same stream", () => {
  const video = createVideoElement();
  const stream = { id: "same-stream" };

  attachStreamToVideo(video, stream);
  attachStreamToVideo(video, stream);

  assert.equal(video.srcObject, stream);
  assert.equal(video.playCalls, 2);
});

test("attachStreamToVideo ignores a missing element or stream", () => {
  const video = createVideoElement();

  assert.equal(attachStreamToVideo(null, { id: "stream" }), false);
  assert.equal(attachStreamToVideo(video, null), false);
  assert.equal(video.srcObject, null);
  assert.equal(video.playCalls, 0);
});

test("attachStreamToVideo tolerates a blocked autoplay promise", () => {
  const video = {
    srcObject: null,
    muted: false,
    play() {
      return Promise.reject(new Error("autoplay blocked"));
    },
  };
  const stream = { id: "blocked-stream" };

  assert.equal(attachStreamToVideo(video, stream), true);
  assert.equal(video.srcObject, stream);
});
