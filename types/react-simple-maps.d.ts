declare module "react-simple-maps" {
  import * as React from "react";

  export interface ComposableMapProps extends React.SVGAttributes<SVGSVGElement> {
    height?: number;
    width?: number;
    projection?: string | ((...args: any[]) => any);
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
      parallels?: [number, number];
    };
  }

  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface GeographiesProps {
    geography?: string | Record<string, any> | string[];
    children: (data: { geographies: any[] }) => React.ReactNode;
    parseGeographies?: (geographies: any[]) => any[];
  }

  export const Geographies: React.FC<GeographiesProps>;

  export interface GeographyProps {
    geography: any;
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseDown?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseUp?: (event: React.MouseEvent<SVGPathElement>) => void;
    onClick?: (event: React.MouseEvent<SVGPathElement>) => void;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
  }

  export const Geography: React.FC<GeographyProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    onClick?: (event: React.MouseEvent<SVGElement>) => void;
    onMouseEnter?: (event: React.MouseEvent<SVGElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGElement>) => void;
    children?: React.ReactNode;
  }

  export const Marker: React.FC<MarkerProps>;
}
