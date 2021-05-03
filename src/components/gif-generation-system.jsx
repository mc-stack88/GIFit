import _ from 'lodash';
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMachine } from '@xstate/react';

import gifGenerationSystemMachine from '../state-machines/gif-generation-system';
import Button from './button.jsx';
import ControlBar from './control-bar.jsx';
import ResizeBar from './resize-bar.jsx';
import IncrementableInput from './incrementable-input.jsx';
import AestheticLines from '$components/aesthetic-lines.jsx';
import SystemElements from '$components/system-elements.jsx';

import ArrowDown from '$icons/arrow-down.svg';
import Cancel from '$icons/cancel.svg';
import MediaPlay from '$icons/media-play.svg';
import Refresh from '$icons/refresh.svg';

function LabelledInput ({ name, width, value, onChange, addendum, ...passthroughProps }) {
  return (
    <label className="gifit__labelled-input">
      <span className="gifit__labelled-input__label">{name}</span>
      <div className="gifit__labelled-input__data">
        <input
          className="gifit__labelled-input__input"
          type="number"
          style={{
            width: `${width}px`
          }}
          value={value}
          onChange={onChange}
          {...passthroughProps} />
        {addendum && <span className="gifit__labelled-input__addendum">{addendum}</span>}
      </div>
    </label>
  );
}

LabelledInput.defaultProps = {
  width: 100
};

function GifGenerationSystem (props) {
  const [state, send] = useMachine(gifGenerationSystemMachine);

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const widthRef = useRef(null);
  const widthBarRef = useRef(null);
  const heightRef = useRef(null);
  const heightBarRef = useRef(null);
  const timeBarRef = useRef(null);
  const startRef = useRef(null);
  const endRef = useRef(null);
  const formRef = useRef(null);
  const contextRef = useRef(state.context);
  const frameCount = Math.floor((state.context.end - state.context.start) * state.context.fps);

  // draw the video to the preview canvas
  function drawFrame () {
    if (canvasRef.current && videoRef.current) {
      const context = canvasRef.current.getContext('2d');
      context.drawImage(
        videoRef.current,
        0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
        0, 0, contextRef.current.width, contextRef.current.height
      );
    }
  }

  const debouncedDrawFrame = _.debounce(drawFrame, 375);

  useEffect(() => {
    debouncedDrawFrame();
  }, [state.context.width, state.context.height, state.context.gifData]);

  // set a reference to the state machine's context for use in other callbacks
  useEffect(() => {
    contextRef.current = state.context;
  }, [state.context]);

  // select the video and tell the machine we're ready to go
  useEffect(() => {
    const videoElements = document.querySelectorAll('video');
    videoRef.current = videoElements[0];

    videoRef.current.pause();
    videoRef.current.addEventListener('seeked', drawFrame);

    send('INITIALIZE_COMPLETE', {
      videoElement: videoRef.current
    });

    return () => {
      videoRef.current.removeEventListener('seeked', drawFrame);
    };
  }, []);

  // TODO don't seek on initial open
  // scrub the video to the start timecode when it changes
  useEffect(() => {
    if (state.context.videoElement && (state.matches('configuring') || state.matches('generating'))) {
      state.context.videoElement.currentTime = state.context.start;
    }
  }, [state.context.start]);

  // scrub the video to the end timecode when it changes
  useEffect(() => {
    if (state.context.videoElement && (state.matches('configuring') || state.matches('generating'))) {
      state.context.videoElement.currentTime = state.context.end;
    }
  }, [state.context.end]);

  // input handling
  function handleWidthInputChange (event) {
    const newWidth = parseInt(event.target.value, 10) || 0;
    const aspectCorrectHeight = parseInt(newWidth / state.context.videoAspectRatio, 10);
    send('INPUT', { key: 'width', value: newWidth });
    send('INPUT', { key: 'height', value: aspectCorrectHeight });
  }

  function handleHeightInputChange (event) {
    const newHeight = parseInt(event.target.value, 10) || 0;
    const aspectCorrectWidth = parseInt(newHeight * state.context.videoAspectRatio, 10);
    send('INPUT', { key: 'width', value: aspectCorrectWidth });
    send('INPUT', { key: 'height', value: newHeight });
  }

  function handleQualityInputChange (event) {
    const newQuality = parseInt(event.target.value, 10) || 0;
    send('INPUT', { key: 'quality', value: newQuality });
  }

  function handleFrameRateInputChange (event) {
    const newFrameRate = parseInt(event.target.value, 10) || 0;
    send('INPUT', { key: 'fps', value: newFrameRate });
  }

  function handleStartInputChange (event) {
    const newStart = parseFloat(event?.target?.value || event) || 0;
    send('INPUT', { key: 'start', value: newStart });
  }

  function handleEndInputChange (event) {
    const newEnd = parseFloat(event?.target?.value || event) || 0;
    send('INPUT', { key: 'end', value: newEnd });
  }

  function handleStartEndControlBarChange ({ start, end, changed }) {
    send('INPUT', { key: 'start', value: start * videoRef.current.duration });
    send('INPUT', { key: 'end', value: end * videoRef.current.duration });

    const newTime = (changed === 'start')
      ? start * videoRef.current.duration
      : end * videoRef.current.duration;

    if (_.isNumber(newTime) && !_.isNaN(newTime)) {
      state.context.videoElement.currentTime = newTime;
    }
  }

  const handleWidthControlBarChange = function ({ scale, size }) {
    const newWidth = size;
    const newHeight = size / state.context.videoAspectRatio;
    send('INPUT', { key: 'width', value: newWidth });
    send('INPUT', { key: 'height', value: newHeight });
  }

  const handleHeightControlBarChange = function ({ scale, size }) {
    const newWidth = size * state.context.videoAspectRatio;
    const newHeight = size;
    send('INPUT', { key: 'width', value: newWidth });
    send('INPUT', { key: 'height', value: newHeight });
  }

  // form submit now handles:
  // generate
  // abort
  // reset
  function handleFormSubmit (event) {
    event.preventDefault();

    if (state.matches('configuring')) {
      send('SUBMIT');
      send('VALIDATION_SUCCESS');
    } else if (state.matches({ generating: { generatingGif: 'succeeded' }})) {
      // 'Reset'
      send('RESET');
    } else if (state.matches('generating')) {
      // Cancel
      send('ABORT');
    }
  }

  if (state.matches('initializing')) {
    return <div>Initializing</div>;
  }

  let submitButtonContents = [];

  if (state.matches('configuring')) {
    submitButtonContents = ['Generate GIF', <MediaPlay />];
  } else if (state.matches('generating') && !state.matches({ generating: { generatingGif: 'succeeded' }})) {
    submitButtonContents = ['Cancel', <Cancel />];
  } else if (state.matches({ generating: { generatingGif: 'succeeded' }})) {
    submitButtonContents = ['Reset', <Refresh />];
  }

  return (
    <div className="gif-generation-system ggs">

      <SystemElements />

      <motion.form
        className="ggs__form"
        initial={{ opacity: 0, transform: 'scale(0.95)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        transition={{ type: 'spring', damping: 45, delay: 1.15, stiffness: 500 }}
        onSubmit={handleFormSubmit}
        ref={formRef}>

        <div
          className="ggs__width__bar"
          style={{ width: `${state.context.width}px` }}
          ref={widthBarRef}>
          <ResizeBar 
            value={state.context.width}
            onChange={handleWidthControlBarChange}
            disabled={!state.matches('configuring')} />
        </div>

        <div className="ggs__dimensions">
          <div className="ggs__width" ref={widthRef}>
            <LabelledInput
              name="Width"
              addendum="px"
              value={state.context.width}
              onChange={handleWidthInputChange}
              width={100}
              disabled={!state.matches('configuring')} />
          </div>
          <div className="ggs__height" ref={heightRef}>
            <LabelledInput
              name="Height"
              addendum="px"
              value={state.context.height}
              onChange={handleHeightInputChange}
              width={100}
              disabled={!state.matches('configuring')} />
          </div>
          <div
            className="ggs__height__bar"
            style={{ height: `${state.context.height}px` }}
            ref={heightBarRef}>
            <ResizeBar
              orientation="vertical"
              value={state.context.height}
              onChange={handleHeightControlBarChange}
              disabled={!state.matches('configuring')} />
          </div>
        </div>
        <div className="ggs__workspace">
          {state.matches({ generating: { generatingGif: 'succeeded' }}) &&
          <img src={URL.createObjectURL(state.context.gifData.blob)} />}
          {!state.matches({ generating: { generatingGif: 'succeeded' }}) &&
          <motion.canvas
            className="ggs__canvas"
            ref={canvasRef}
            style={{ width: state.context.width, height: state.context.height, willChange: 'width, height' }}
            animate={{ width: state.context.width, height: state.context.height }}
            transition={{ bounce: 0, delay: 0.75 }}
            height={state.context.height}
            width={state.context.width} />}
        </div>
        <div className="ggs__quality-and-frame-rate">
          <LabelledInput
            name="Quality"
            value={state.context.quality}
            onChange={handleQualityInputChange}
            disabled={!state.matches('configuring')} />
          <LabelledInput
            name="Frame Rate"
            addendum="fps"
            value={state.context.fps}
            onChange={handleFrameRateInputChange}
            disabled={!state.matches('configuring')} />
        </div>
        <div className="ggs__start-and-end">
          <div className="ggs__time__bar" ref={timeBarRef}>
            <ControlBar
              startValue={state.context.start / videoRef.current.duration}
              endValue={state.context.end / videoRef.current.duration}
              onChange={handleStartEndControlBarChange}
              disabled={!state.matches('configuring')} />
          </div>
          <div className="ggs__start">
            <label className="gifit__labelled-input" ref={startRef}>
              <span className="gifit__labelled-input__label">Start</span>
              <div className="gifit__labelled-input__data">
                <IncrementableInput
                  value={state.context.start}
                  increment={1 / state.context.fps}
                  min={0}
                  max={state.context.end}
                  width="200px"
                  onChange={handleStartInputChange}
                  disabled={!state.matches('configuring')} />
              </div>
            </label>
          </div>

          <div className="gifit__frames-viz">
            {_.times(frameCount, (i) => (
              <span key={i} className="gifit__frames-viz__frame"></span>
            ))}
            <span className="gifit__frames-viz__count">{frameCount}</span>
          </div>
          
          <div className="ggs__end">
            <label className="gifit__labelled-input" ref={endRef}>
              <span className="gifit__labelled-input__label">End</span>
              <div className="gifit__labelled-input__data">
                <IncrementableInput
                  value={state.context.end}
                  increment={1 / state.context.fps}
                  min={state.context.start}
                  max={videoRef.current.duration}
                  width="200px"
                  onChange={handleEndInputChange}
                  disabled={!state.matches('configuring')} />
              </div>
            </label>
          </div>
        </div>

        <footer className="ggs__footer">
          <div className="ggs__actions">
            <span className="ggs__action">
              <Button
                type="submit"
                icon={submitButtonContents[1]}>
                {submitButtonContents[0]}
              </Button>
            </span>
            <a
              className="ggs__save ggs__action"
              href={state?.context?.gifData?.blob ? URL.createObjectURL(state.context.gifData.blob) : null}
              download={`gifit_${Date.now()}.gif`}>
              <Button
                type="button"
                icon={<ArrowDown />}
                disabled={!state.matches({ generating: { generatingGif: 'succeeded' }})}>
                Save GIF
              </Button>
            </a>
          </div>
        </footer>

        <AestheticLines
          widthRef={widthRef}
          widthBarRef={widthBarRef}
          heightRef={heightRef}
          heightBarRef={heightBarRef}
          startRef={startRef}
          endRef={endRef}
          timeBarRef={timeBarRef} />
      </motion.form>
    </div>
  );
}

export default GifGenerationSystem;
