"use client";

import { useEffect, useRef } from "react";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "supportive" | "warning" | "confused";

interface AvatarProps {
  width?: number;
  height?: number;
  isListening?: boolean;
  isSpeaking?: boolean;
  state?: AvatarState;
}

export default function Avatar({
  width = 500,
  height = 600,
  isListening = false,
  isSpeaking = false,
  state = "idle"
}: AvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawAvatar = (time: number) => {
      timeRef.current = time;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const baseY = height * 0.12;

      // Subtle breathing animation
      const breatheOffset = Math.sin(time / 1500) * 2;

      // Speaking animation
      const speakOffset = isSpeaking
        ? Math.sin(time / 100) * 3 + Math.sin(time / 150) * 2
        : 0;

      // Draw in order (back to front)
      drawBackHair(ctx, centerX, baseY + breatheOffset);
      drawBody(ctx, centerX, baseY + breatheOffset);
      drawNeck(ctx, centerX, baseY + breatheOffset);
      drawFace(ctx, centerX, baseY + breatheOffset);
      drawHair(ctx, centerX, baseY + breatheOffset);
      drawEyes(ctx, centerX, baseY + breatheOffset, isListening, time);
      drawNose(ctx, centerX, baseY + breatheOffset);
      drawMouth(ctx, centerX, baseY + breatheOffset, isSpeaking, speakOffset);
      drawEyebrows(ctx, centerX, baseY + breatheOffset, state);
      drawStethoscope(ctx, centerX, baseY + breatheOffset);
      drawHairOverEars(ctx, centerX, baseY + breatheOffset);
      drawNameBadge(ctx, centerX, baseY + breatheOffset);

      animationRef.current = requestAnimationFrame(drawAvatar);
    };

    animationRef.current = requestAnimationFrame(drawAvatar);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, isListening, isSpeaking, state]);

  const stateColors: Record<AvatarState, string> = {
    idle: "text-gray-500",
    listening: "text-blue-500",
    thinking: "text-purple-500",
    speaking: "text-green-500",
    supportive: "text-teal-500",
    warning: "text-amber-500",
    confused: "text-orange-500"
  };

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg"
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <div className={`-mt-16 text-lg font-semibold capitalize ${stateColors[state]}`}>
        {state}
      </div>
    </div>
  );
}

function drawBody(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Scrubs - teal medical color
  const gradient = ctx.createLinearGradient(centerX - 100, baseY + 180, centerX + 100, baseY + 420);
  gradient.addColorStop(0, "#14b8a6");
  gradient.addColorStop(1, "#0d9488");

  ctx.beginPath();
  ctx.moveTo(centerX - 85, baseY + 180);

  // Shoulders
  ctx.quadraticCurveTo(centerX - 120, baseY + 200, centerX - 100, baseY + 280);

  // Left arm
  ctx.lineTo(centerX - 90, baseY + 380);
  ctx.lineTo(centerX - 60, baseY + 380);
  ctx.lineTo(centerX - 65, baseY + 280);

  // Body
  ctx.lineTo(centerX - 50, baseY + 420);
  ctx.lineTo(centerX + 50, baseY + 420);
  ctx.lineTo(centerX + 65, baseY + 280);

  // Right arm
  ctx.lineTo(centerX + 60, baseY + 380);
  ctx.lineTo(centerX + 90, baseY + 380);
  ctx.lineTo(centerX + 100, baseY + 280);

  // Right shoulder
  ctx.quadraticCurveTo(centerX + 120, baseY + 200, centerX + 85, baseY + 180);

  // V-neck
  ctx.lineTo(centerX + 25, baseY + 180);
  ctx.quadraticCurveTo(centerX + 15, baseY + 200, centerX, baseY + 215);
  ctx.quadraticCurveTo(centerX - 15, baseY + 200, centerX - 25, baseY + 180);

  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawNeck(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Chest/upper body skin in V-neck area to cover hair showing through
  const chestGradient = ctx.createLinearGradient(centerX, baseY + 175, centerX, baseY + 220);
  chestGradient.addColorStop(0, "#f0c9b0");
  chestGradient.addColorStop(1, "#e5b99a");

  ctx.beginPath();
  ctx.moveTo(centerX - 27, baseY + 178);
  ctx.lineTo(centerX + 27, baseY + 178);
  ctx.quadraticCurveTo(centerX + 15, baseY + 200, centerX, baseY + 217);
  ctx.quadraticCurveTo(centerX - 15, baseY + 200, centerX - 27, baseY + 178);
  ctx.closePath();
  ctx.fillStyle = chestGradient;
  ctx.fill();

  // Neck
  const neckGradient = ctx.createLinearGradient(centerX - 25, baseY + 140, centerX + 25, baseY + 140);
  neckGradient.addColorStop(0, "#e8c4a8");
  neckGradient.addColorStop(0.5, "#f0c9b0");
  neckGradient.addColorStop(1, "#e8c4a8");

  ctx.beginPath();
  ctx.moveTo(centerX - 20, baseY + 150);
  ctx.quadraticCurveTo(centerX - 25, baseY + 170, centerX - 25, baseY + 185);
  ctx.lineTo(centerX + 25, baseY + 185);
  ctx.quadraticCurveTo(centerX + 25, baseY + 170, centerX + 20, baseY + 150);
  ctx.closePath();
  ctx.fillStyle = neckGradient;
  ctx.fill();
}

function drawFace(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Face shape - slimmer cheeks
  const faceGradient = ctx.createRadialGradient(
    centerX, baseY + 80, 10,
    centerX, baseY + 85, 90
  );
  faceGradient.addColorStop(0, "#f5d6c6");
  faceGradient.addColorStop(0.7, "#e8c4a8");
  faceGradient.addColorStop(1, "#deb896");

  ctx.beginPath();
  ctx.ellipse(centerX, baseY + 85, 62, 82, 0, 0, Math.PI * 2);
  ctx.fillStyle = faceGradient;
  ctx.fill();

  // Subtle cheek blush
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(centerX - 38, baseY + 95, 15, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e57373";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(centerX + 38, baseY + 95, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBackHair(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  const gradient = ctx.createLinearGradient(centerX, baseY, centerX, baseY + 280);
  gradient.addColorStop(0, "#3d2418");
  gradient.addColorStop(0.5, "#2d1810");
  gradient.addColorStop(1, "#1f110a");

  ctx.beginPath();
  ctx.moveTo(centerX - 75, baseY + 160);
  ctx.quadraticCurveTo(centerX - 80, baseY + 80, centerX - 55, baseY + 20);
  ctx.quadraticCurveTo(centerX, baseY - 5, centerX + 55, baseY + 20);
  ctx.quadraticCurveTo(centerX + 80, baseY + 80, centerX + 75, baseY + 160);
  ctx.quadraticCurveTo(centerX + 80, baseY + 220, centerX + 70, baseY + 270);
  ctx.quadraticCurveTo(centerX + 35, baseY + 290, centerX, baseY + 280);
  ctx.quadraticCurveTo(centerX - 35, baseY + 290, centerX - 70, baseY + 270);
  ctx.quadraticCurveTo(centerX - 80, baseY + 220, centerX - 75, baseY + 160);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawHair(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Front hair
  const hairGradient = ctx.createLinearGradient(centerX - 65, baseY, centerX + 65, baseY + 60);
  hairGradient.addColorStop(0, "#4a2d20");
  hairGradient.addColorStop(0.5, "#3d2418");
  hairGradient.addColorStop(1, "#2d1810");

  ctx.beginPath();
  ctx.moveTo(centerX - 62, baseY + 60);

  // Left side
  ctx.quadraticCurveTo(centerX - 68, baseY + 35, centerX - 55, baseY + 15);

  // Top
  ctx.quadraticCurveTo(centerX - 25, baseY - 5, centerX, baseY);
  ctx.quadraticCurveTo(centerX + 25, baseY - 5, centerX + 55, baseY + 15);

  // Right side
  ctx.quadraticCurveTo(centerX + 68, baseY + 35, centerX + 62, baseY + 60);

  // Hairline
  ctx.quadraticCurveTo(centerX + 50, baseY + 40, centerX + 35, baseY + 30);
  ctx.quadraticCurveTo(centerX + 15, baseY + 22, centerX, baseY + 25);
  ctx.quadraticCurveTo(centerX - 15, baseY + 22, centerX - 35, baseY + 30);
  ctx.quadraticCurveTo(centerX - 50, baseY + 40, centerX - 62, baseY + 60);

  ctx.closePath();
  ctx.fillStyle = hairGradient;
  ctx.fill();

  // Side hair strands
  ctx.fillStyle = "#3d2418";

  // Left side
  ctx.beginPath();
  ctx.moveTo(centerX - 60, baseY + 50);
  ctx.quadraticCurveTo(centerX - 72, baseY + 90, centerX - 65, baseY + 140);
  ctx.quadraticCurveTo(centerX - 58, baseY + 100, centerX - 55, baseY + 55);
  ctx.closePath();
  ctx.fill();

  // Right side
  ctx.beginPath();
  ctx.moveTo(centerX + 60, baseY + 50);
  ctx.quadraticCurveTo(centerX + 72, baseY + 90, centerX + 65, baseY + 140);
  ctx.quadraticCurveTo(centerX + 58, baseY + 100, centerX + 55, baseY + 55);
  ctx.closePath();
  ctx.fill();
}

// Hair that covers half the ear and lays on top of stethoscope
function drawHairOverEars(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  const hairGradient = ctx.createLinearGradient(centerX - 70, baseY + 60, centerX - 55, baseY + 140);
  hairGradient.addColorStop(0, "#3d2418");
  hairGradient.addColorStop(0.5, "#4a2d20");
  hairGradient.addColorStop(1, "#2d1810");

  // Left side - hair covering ear and stethoscope
  ctx.beginPath();
  ctx.moveTo(centerX - 58, baseY + 55);
  ctx.bezierCurveTo(
    centerX - 70, baseY + 75,
    centerX - 72, baseY + 100,
    centerX - 65, baseY + 135
  );
  ctx.quadraticCurveTo(centerX - 58, baseY + 115, centerX - 55, baseY + 85);
  ctx.quadraticCurveTo(centerX - 54, baseY + 65, centerX - 58, baseY + 55);
  ctx.fillStyle = hairGradient;
  ctx.fill();

  // Right side
  const hairGradient2 = ctx.createLinearGradient(centerX + 55, baseY + 60, centerX + 70, baseY + 140);
  hairGradient2.addColorStop(0, "#3d2418");
  hairGradient2.addColorStop(0.5, "#4a2d20");
  hairGradient2.addColorStop(1, "#2d1810");

  ctx.beginPath();
  ctx.moveTo(centerX + 58, baseY + 55);
  ctx.bezierCurveTo(
    centerX + 70, baseY + 75,
    centerX + 72, baseY + 100,
    centerX + 65, baseY + 135
  );
  ctx.quadraticCurveTo(centerX + 58, baseY + 115, centerX + 55, baseY + 85);
  ctx.quadraticCurveTo(centerX + 54, baseY + 65, centerX + 58, baseY + 55);
  ctx.fillStyle = hairGradient2;
  ctx.fill();
}

function drawEyes(ctx: CanvasRenderingContext2D, centerX: number, baseY: number, isListening: boolean, time: number) {
  const eyeY = baseY + 75;
  const leftEyeX = centerX - 22;
  const rightEyeX = centerX + 22;

  // Blink animation
  const blinkCycle = time % 4000;
  const isBlinking = blinkCycle > 3800;
  const eyeOpenness = isBlinking ? 0.1 : 1;

  // Eye whites
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(leftEyeX, eyeY, 12, 10 * eyeOpenness, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightEyeX, eyeY, 12, 10 * eyeOpenness, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isBlinking) {
    // Iris
    const irisGradient = ctx.createRadialGradient(leftEyeX - 1, eyeY - 1, 0, leftEyeX, eyeY, 7);
    irisGradient.addColorStop(0, "#8B5A2B");
    irisGradient.addColorStop(0.7, "#6B4423");
    irisGradient.addColorStop(1, "#4a2512");

    ctx.beginPath();
    ctx.ellipse(leftEyeX, eyeY, 7, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = irisGradient;
    ctx.fill();

    const irisGradient2 = ctx.createRadialGradient(rightEyeX - 1, eyeY - 1, 0, rightEyeX, eyeY, 7);
    irisGradient2.addColorStop(0, "#8B5A2B");
    irisGradient2.addColorStop(0.7, "#6B4423");
    irisGradient2.addColorStop(1, "#4a2512");

    ctx.beginPath();
    ctx.ellipse(rightEyeX, eyeY, 7, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = irisGradient2;
    ctx.fill();

    // Pupils
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(leftEyeX, eyeY, 3.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightEyeX, eyeY, 3.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(leftEyeX - 2, eyeY - 2, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightEyeX - 2, eyeY - 2, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyelashes
  ctx.strokeStyle = "#2a1510";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";

  // Upper lashes - left eye
  for (let i = -3; i <= 3; i++) {
    const angle = (i * 0.15) - Math.PI / 2;
    const startX = leftEyeX + Math.cos(angle) * 12;
    const startY = eyeY + Math.sin(angle) * 10 * eyeOpenness;
    const endX = leftEyeX + Math.cos(angle - 0.2) * 17;
    const endY = eyeY + Math.sin(angle - 0.2) * 14 * eyeOpenness;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Upper lashes - right eye
  for (let i = -3; i <= 3; i++) {
    const angle = (i * 0.15) - Math.PI / 2;
    const startX = rightEyeX + Math.cos(angle) * 12;
    const startY = eyeY + Math.sin(angle) * 10 * eyeOpenness;
    const endX = rightEyeX + Math.cos(angle + 0.2) * 17;
    const endY = eyeY + Math.sin(angle + 0.2) * 14 * eyeOpenness;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function drawEyebrows(ctx: CanvasRenderingContext2D, centerX: number, baseY: number, state: AvatarState) {
  // Adjust eyebrow position based on state
  let leftInner = baseY + 52;
  let leftOuter = baseY + 55;
  let rightInner = baseY + 52;
  let rightOuter = baseY + 55;

  if (state === "warning") {
    // Furrowed brows
    leftInner = baseY + 48;
    rightInner = baseY + 48;
  } else if (state === "confused") {
    // Asymmetric - one raised
    leftInner = baseY + 50;
    leftOuter = baseY + 58;
  } else if (state === "supportive") {
    // Slightly raised outer corners
    leftOuter = baseY + 50;
    rightOuter = baseY + 50;
  }

  ctx.strokeStyle = "#4a3020";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // Left eyebrow
  ctx.beginPath();
  ctx.moveTo(centerX - 40, leftOuter);
  ctx.quadraticCurveTo(centerX - 28, leftInner - 3, centerX - 12, leftInner);
  ctx.stroke();

  // Right eyebrow
  ctx.beginPath();
  ctx.moveTo(centerX + 12, rightInner);
  ctx.quadraticCurveTo(centerX + 28, rightInner - 3, centerX + 40, rightOuter);
  ctx.stroke();
}

function drawNose(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  ctx.strokeStyle = "#d4a078";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  // Nose bridge and tip
  ctx.beginPath();
  ctx.moveTo(centerX, baseY + 75);
  ctx.quadraticCurveTo(centerX - 2, baseY + 95, centerX - 8, baseY + 108);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, baseY + 75);
  ctx.quadraticCurveTo(centerX + 2, baseY + 95, centerX + 8, baseY + 108);
  ctx.stroke();

  // Nostrils
  ctx.beginPath();
  ctx.moveTo(centerX - 8, baseY + 108);
  ctx.quadraticCurveTo(centerX, baseY + 113, centerX + 8, baseY + 108);
  ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, centerX: number, baseY: number, isSpeaking: boolean, speakOffset: number) {
  const mouthY = baseY + 130;

  if (isSpeaking) {
    const mouthOpen = Math.max(2, 5 + speakOffset);
    const upperLipOffset = -mouthOpen * 0.3;

    // Mouth opening
    ctx.fillStyle = "#2a1515";
    ctx.beginPath();
    ctx.ellipse(centerX, mouthY + 2, 15, mouthOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper lip
    ctx.fillStyle = "#c97878";
    ctx.beginPath();
    ctx.moveTo(centerX - 22, mouthY + upperLipOffset);
    ctx.quadraticCurveTo(centerX - 10, mouthY - 5 + upperLipOffset, centerX, mouthY - 3 + upperLipOffset);
    ctx.quadraticCurveTo(centerX + 10, mouthY - 5 + upperLipOffset, centerX + 22, mouthY + upperLipOffset);
    ctx.quadraticCurveTo(centerX + 10, mouthY + 2 + upperLipOffset, centerX, mouthY + 1 + upperLipOffset);
    ctx.quadraticCurveTo(centerX - 10, mouthY + 2 + upperLipOffset, centerX - 22, mouthY + upperLipOffset);
    ctx.fill();

    // Lower lip
    ctx.beginPath();
    ctx.moveTo(centerX - 18, mouthY + 2 + mouthOpen);
    ctx.quadraticCurveTo(centerX, mouthY + 10 + mouthOpen, centerX + 18, mouthY + 2 + mouthOpen);
    ctx.quadraticCurveTo(centerX, mouthY + 6 + mouthOpen, centerX - 18, mouthY + 2 + mouthOpen);
    ctx.fill();
  } else {
    // Closed mouth - gentle smile
    ctx.fillStyle = "#c97878";

    // Upper lip
    ctx.beginPath();
    ctx.moveTo(centerX - 20, mouthY);
    ctx.quadraticCurveTo(centerX - 10, mouthY - 4, centerX, mouthY - 2);
    ctx.quadraticCurveTo(centerX + 10, mouthY - 4, centerX + 20, mouthY);
    ctx.quadraticCurveTo(centerX + 10, mouthY + 2, centerX, mouthY + 1);
    ctx.quadraticCurveTo(centerX - 10, mouthY + 2, centerX - 20, mouthY);
    ctx.fill();

    // Lower lip
    ctx.beginPath();
    ctx.moveTo(centerX - 18, mouthY + 2);
    ctx.quadraticCurveTo(centerX, mouthY + 10, centerX + 18, mouthY + 2);
    ctx.quadraticCurveTo(centerX, mouthY + 6, centerX - 18, mouthY + 2);
    ctx.fill();

    // Lip line
    ctx.strokeStyle = "#a86868";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 18, mouthY + 1);
    ctx.quadraticCurveTo(centerX, mouthY + 4, centerX + 18, mouthY + 1);
    ctx.stroke();
  }
}

function drawStethoscope(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Tubing
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  // Left tube going to ear
  ctx.beginPath();
  ctx.moveTo(centerX - 10, baseY + 220);
  ctx.bezierCurveTo(
    centerX - 30, baseY + 180,
    centerX - 50, baseY + 130,
    centerX - 62, baseY + 95
  );
  ctx.stroke();

  // Right tube going to ear
  ctx.beginPath();
  ctx.moveTo(centerX + 10, baseY + 220);
  ctx.bezierCurveTo(
    centerX + 30, baseY + 180,
    centerX + 50, baseY + 130,
    centerX + 62, baseY + 95
  );
  ctx.stroke();

  // Y-connector at chest
  ctx.beginPath();
  ctx.moveTo(centerX - 10, baseY + 220);
  ctx.quadraticCurveTo(centerX, baseY + 235, centerX + 10, baseY + 220);
  ctx.stroke();

  // Main tube going down
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(centerX, baseY + 232);
  ctx.lineTo(centerX, baseY + 290);
  ctx.stroke();

  // Chest piece
  const chestPieceGradient = ctx.createRadialGradient(
    centerX - 2, baseY + 300, 0,
    centerX, baseY + 305, 18
  );
  chestPieceGradient.addColorStop(0, "#555555");
  chestPieceGradient.addColorStop(0.5, "#3a3a3a");
  chestPieceGradient.addColorStop(1, "#2a2a2a");

  ctx.beginPath();
  ctx.ellipse(centerX, baseY + 305, 16, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = chestPieceGradient;
  ctx.fill();

  // Inner ring
  ctx.beginPath();
  ctx.ellipse(centerX, baseY + 305, 11, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#444444";
  ctx.fill();

  // Diaphragm
  ctx.beginPath();
  ctx.ellipse(centerX, baseY + 305, 7, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#666666";
  ctx.fill();

  // Ear pieces
  ctx.fillStyle = "#333333";
  ctx.beginPath();
  ctx.ellipse(centerX - 64, baseY + 92, 4, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX + 64, baseY + 92, 4, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawNameBadge(ctx: CanvasRenderingContext2D, centerX: number, baseY: number) {
  // Badge clip
  ctx.fillStyle = "#888888";
  ctx.beginPath();
  ctx.roundRect(centerX + 40, baseY + 215, 5, 12, 2);
  ctx.fill();

  // Badge
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(centerX + 28, baseY + 228, 45, 32, 3);
  ctx.fill();

  // Badge border
  ctx.strokeStyle = "#0d9488";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(centerX + 28, baseY + 228, 45, 32, 3);
  ctx.stroke();

  // Medical cross
  ctx.fillStyle = "#0d9488";
  ctx.fillRect(centerX + 46, baseY + 234, 8, 2);
  ctx.fillRect(centerX + 49, baseY + 231, 2, 8);

  // Name text
  ctx.fillStyle = "#333333";
  ctx.font = "bold 6px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HEALTHCARE", centerX + 50, baseY + 250);
  ctx.font = "5px Arial, sans-serif";
  ctx.fillStyle = "#666666";
  ctx.fillText("AI Assistant", centerX + 50, baseY + 257);
}
