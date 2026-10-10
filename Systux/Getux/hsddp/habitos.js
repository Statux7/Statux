[...]
  function drawPlaceholderSilhouette(ctx, W, H, gender, t) {
    ctx.save();

    /*
     * Las siluetas se escalan para caber en el nodo del canvas.
     * viewBox original del SVG: el usuario debe revisar su SVG y
     * ajustar SVG_W y SVG_H al viewBox real de sus archivos.
     * Ejemplo: si el SVG tiene viewBox="0 0 100 200", SVG_W=100, SVG_H=200.
     */
    const SVG_W = 100;   // ajustar al viewBox real del SVG del usuario
    const SVG_H = 200;   // ajustar al viewBox real del SVG del usuario

    // Escalar y centrar la silueta dentro del nodo
    const scaleX = W / SVG_W;
    const scaleY = H / SVG_H;
    const scale = Math.min(scaleX, scaleY) * 0.85;
    const offsetX = (W - SVG_W * scale) / 2;
    const offsetY = (H - SVG_H * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Pulso de opacidad suave (animación de respiración)
    const pulse = 0.55 + 0.08 * Math.sin(t * 0.025);
    ctx.globalAlpha = pulse;

    if (gender === 'male') {
      /*
       * SILUETA HOMBRE
       * Pega aquí el path SVG del hombre.
       * Formato: ctx.fillStyle = '#fff'; ctx.fill(new Path2D('M ... Z'));
       * O si prefieres dibujar directamente con canvas, usa ctx.beginPath(), etc.
       * RUTA DEL ARCHIVO: [PASTE_MALE_SVG_PATH_HERE]
       */

      // Placeholder temporal hasta que se peguen los paths:
      ctx.strokeStyle = '#ffffff22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SVG_W / 2, SVG_H * 0.12, SVG_W * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(SVG_W / 2, SVG_H * 0.22);
      ctx.lineTo(SVG_W / 2, SVG_H * 0.62);
      ctx.moveTo(SVG_W * 0.3, SVG_H * 0.35);
      ctx.lineTo(SVG_W * 0.7, SVG_H * 0.35);
      ctx.moveTo(SVG_W / 2, SVG_H * 0.62);
      ctx.lineTo(SVG_W * 0.35, SVG_H * 0.92);
      ctx.moveTo(SVG_W / 2, SVG_H * 0.62);
      ctx.lineTo(SVG_W * 0.65, SVG_H * 0.92);
      ctx.stroke();

    } else if (gender === 'female') {
      /*
       * SILUETA MUJER
       * Pega aquí el path SVG de la mujer.
       * Formato: ctx.fillStyle = '#fff'; ctx.fill(new Path2D('M ... Z'));
       * O si prefieres dibujar directamente con canvas, usa ctx.beginPath(), etc.
       * RUTA DEL ARCHIVO: [PASTE_FEMALE_SVG_PATH_HERE]
       */

      // Placeholder temporal hasta que se peguen los paths:
      ctx.strokeStyle = '#ffffff22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SVG_W / 2, SVG_H * 0.12, SVG_W * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(SVG_W / 2, SVG_H * 0.22);
      ctx.lineTo(SVG_W / 2, SVG_H * 0.55);
      ctx.moveTo(SVG_W * 0.25, SVG_H * 0.3);
      ctx.lineTo(SVG_W * 0.75, SVG_H * 0.3);
      ctx.moveTo(SVG_W / 2, SVG_H * 0.55);
      ctx.lineTo(SVG_W * 0.3, SVG_H * 0.92);
      ctx.moveTo(SVG_W / 2, SVG_H * 0.55);
      ctx.lineTo(SVG_W * 0.7, SVG_H * 0.92);
      ctx.stroke();
    }

    ctx.restore();
  }
[...]
