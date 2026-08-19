import React from 'react'

export default function Icon({ icon, size = 16, className = '' }) {
  if (!icon) return null

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icon.map(renderIconNode)}
    </svg>
  )
}

function renderIconNode([tag, attrs, children], index) {
  return React.createElement(
    tag,
    { key: index, ...attrs },
    children?.map(renderIconNode),
  )
}
