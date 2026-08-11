<template>
  <!--
    "IntelliEditor by EigenPal" lockup — the exact same mark used in the
    docx-editor.dev site header (DocxIcon + wordmark + EigenpalLogo). Kept in
    `examples/shared` so the React + Vue previews show an identical brand.
  -->
  <a
    href="https://docx-editor.dev"
    target="_blank"
    rel="noopener noreferrer"
    class="brand-logo"
    title="IntelliEditor by EigenPal"
  >
    <svg
        class="brand-logo__doc"
        viewBox="0 0 70 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M2 2H48L68 22V78H2V2Z"
          fill="#FAF9F8"
          stroke="#201F1E"
          stroke-width="4"
          stroke-linejoin="round"
        />
        <path
          d="M48 2V22H68"
          fill="#DEECF9"
          stroke="#201F1E"
          stroke-width="4"
          stroke-linejoin="round"
        />
        <path d="M48 2V22H68L48 2Z" fill="#DEECF9" />
        <rect x="13" y="32" width="28" height="4" fill="#201F1E" opacity="0.25" />
        <rect x="13" y="42" width="38" height="4" fill="#201F1E" opacity="0.15" />
        <rect x="13" y="52" width="33" height="4" fill="#201F1E" opacity="0.15" />
        <rect x="13" y="62" width="36" height="4" fill="#201F1E" opacity="0.15" />
        <rect x="13" y="82" width="44" height="16" fill="#185ABD" stroke="#201F1E" stroke-width="3" />
        <text
          x="35"
          y="94"
          text-anchor="middle"
          fill="#FAF9F8"
          font-size="11"
          font-weight="900"
          font-family="system-ui, sans-serif"
        >
          .DOCX
        </text>
      </svg>
    <span class="brand-logo__stack">
      <span class="brand-logo__title">IntelliEditor</span>
      <span class="brand-logo__by">
      by
      <span class="brand-logo__vendor">jiresse Alfred</span>
      </span>
    </span>
  </a>
</template>

<script setup lang="ts">
// Presentational only — no props.
</script>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.brand-logo__stack {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
}
.brand-logo__doc {
  width: 19px;
  height: auto;
  flex-shrink: 0;
}
.brand-logo__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.005em;
  color: var(--doc-text);
  white-space: nowrap;
}
.brand-logo__by {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1.1;
  color: var(--doc-text-subtle);
  white-space: nowrap;
}
.brand-logo__eigenpal {
  width: 10px;
  height: 11px;
  flex-shrink: 0;
}
.brand-logo__vendor {
  font-weight: 600;
  color: var(--doc-text);
}
</style>
