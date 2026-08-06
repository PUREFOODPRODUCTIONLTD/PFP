export const customers = {
    atis: {
    slug: "atis",
          name: "ATIS",
          tagline: "Powered by Pure Food Production",
          logo: "/logos/atis.png",
          colors: {
      forest: "#0b3550",
              forestDark: "#022234",
              amberDark: "#7a6a12",
              badgeBg: "#faf6d9",
              badgeBorder: "#ece2a0"
        }
    }
};

export function getCustomer(slug) {
    return customers[slug] || null;
}
