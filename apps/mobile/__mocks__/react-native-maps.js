// react-native-maps is a native view with no JS implementation under Jest.
// Each export becomes a plain View that keeps its props and children, so tests
// can assert what the screens hand to the map (regions, polylines, tiles).
const React = require('react');
const { View } = require('react-native');

function passthrough(name) {
  const C = ({ children, ...props }) => React.createElement(View, { testID: name, ...props }, children);
  C.displayName = name;
  return C;
}

module.exports = {
  __esModule: true,
  default: passthrough('MapView'),
  Marker: passthrough('Marker'),
  Polygon: passthrough('Polygon'),
  Polyline: passthrough('Polyline'),
  UrlTile: passthrough('UrlTile'),
  PROVIDER_GOOGLE: 'google',
};
