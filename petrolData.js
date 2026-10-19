// Numbers measured from our petrol pump dataset (Final_Data_Transformed.csv):
// 300 vehicles over 6 days. Inter-arrival time of a vehicle = service time of the
// vehicle before it (same day), so there are 294 inter-arrival values.
const petrolData = {
  vehicles: 300,
  days: 6,
  interArrival: { meanSec: 40.146259, sdSec: 23.537981 },
  service:      { meanSec: 39.943333, sdSec: 23.451796 }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = petrolData;
}
if (typeof window !== 'undefined') {
  window.petrolData = petrolData;
}

